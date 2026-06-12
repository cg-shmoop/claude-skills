/**
 * UIABridge - TypeScript bridge to the C# BrailleTestAdapter subprocess.
 *
 * Communicates via JSON-RPC over stdio: one JSON line per request on stdin,
 * one JSON line per response on stdout. The adapter signals readiness by
 * writing "BrailleTestAdapter ready" to stderr.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import { join } from 'node:path';
import type { PlatformAdapter } from './platform-adapter.js';
import type { ElementInfo } from '../types/index.js';

// Path to the C# adapter project
const ADAPTER_PROJECT_PATH = join(
  import.meta.dirname ?? '',
  '..', '..', 'Adapter', 'BrailleTestAdapter.csproj',
);

const READY_SIGNAL = 'BrailleTestAdapter ready';
const STARTUP_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;

interface JsonRpcRequest {
  method: string;
  params: Record<string, unknown>;
  id: number;
}

interface JsonRpcResponse {
  id: number;
  result: unknown;
  error?: { code: number; message: string };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class UIABridge implements PlatformAdapter {
  private process: ChildProcess | null = null;
  private readline: ReadlineInterface | null = null;
  private ready = false;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private adapterPath: string;

  constructor(adapterProjectPath?: string) {
    this.adapterPath = adapterProjectPath ?? ADAPTER_PROJECT_PATH;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.process) {
      throw new Error('UIABridge: adapter process already running');
    }

    this.ready = false;
    this.nextId = 1;
    this.pending.clear();

    const child = spawn('dotnet', ['run', '--project', this.adapterPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.process = child;

    // Parse JSON-RPC responses from stdout (one JSON object per line)
    this.readline = createInterface({ input: child.stdout! });
    this.readline.on('line', (line: string) => this.handleResponseLine(line));

    // Wait for the ready signal on stderr
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`UIABridge: adapter did not become ready within ${STARTUP_TIMEOUT_MS}ms`));
      }, STARTUP_TIMEOUT_MS);

      const stderrRl = createInterface({ input: child.stderr! });
      stderrRl.on('line', (line: string) => {
        // Forward adapter stderr for diagnostics
        if (process.env.UIA_BRIDGE_DEBUG) {
          process.stderr.write(`[adapter] ${line}\n`);
        }

        if (line.includes(READY_SIGNAL)) {
          clearTimeout(timeout);
          this.ready = true;
          resolve();
        }
      });

      child.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(new Error(`UIABridge: failed to spawn adapter process: ${err.message}`));
      });

      child.on('exit', (code: number | null) => {
        if (!this.ready) {
          clearTimeout(timeout);
          reject(new Error(`UIABridge: adapter exited before ready (code ${code})`));
        }
      });
    });

    // Handle unexpected exit after startup
    child.on('exit', (code: number | null) => {
      this.ready = false;
      // Reject all pending requests
      for (const [id, req] of this.pending) {
        clearTimeout(req.timer);
        req.reject(new Error(`UIABridge: adapter process exited (code ${code})`));
      }
      this.pending.clear();
      this.process = null;
      this.readline = null;
    });
  }

  async stop(): Promise<void> {
    if (!this.process) return;

    // Try graceful exit first
    try {
      await this.sendRequest('exit', {});
    } catch {
      // Ignore -- process may already be dead
    }

    // Give it a moment then force-kill
    const child = this.process;
    this.process = null;
    this.ready = false;
    this.readline = null;

    if (child && !child.killed) {
      // Wait briefly for graceful shutdown
      await new Promise<void>((resolve) => {
        const forceKillTimer = setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
          resolve();
        }, 2_000);

        child.on('exit', () => {
          clearTimeout(forceKillTimer);
          resolve();
        });
      });
    }

    // Reject remaining pending requests
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error('UIABridge: stopped'));
    }
    this.pending.clear();
  }

  isReady(): boolean {
    return this.ready;
  }

  // ---------------------------------------------------------------------------
  // Tree navigation
  // ---------------------------------------------------------------------------

  async getFocusedElement(): Promise<ElementInfo | null> {
    const result = await this.call('getFocusedElement', {});
    return result as ElementInfo | null;
  }

  async getRootElement(processId: number): Promise<ElementInfo | null> {
    const result = await this.call('getRootElement', { processId });
    return result as ElementInfo | null;
  }

  async getChildren(automationId: string, processId: number): Promise<ElementInfo[]> {
    const result = await this.call('getChildren', { automationId, processId });
    return (result as ElementInfo[]) ?? [];
  }

  // ---------------------------------------------------------------------------
  // Element search
  // ---------------------------------------------------------------------------

  async findAll(processId: number, property: string, value: string): Promise<ElementInfo[]> {
    const result = await this.call('findAll', { processId, property, value });
    return (result as ElementInfo[]) ?? [];
  }

  async findFirst(processId: number, property: string, value: string): Promise<ElementInfo | null> {
    const result = await this.call('findFirst', { processId, property, value });
    return result as ElementInfo | null;
  }

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------

  async invoke(automationId: string, processId: number): Promise<boolean> {
    const result = await this.call('invoke', { automationId, processId });
    return result as boolean;
  }

  async setValue(automationId: string, value: string, processId: number): Promise<boolean> {
    const result = await this.call('setValue', { automationId, value, processId });
    return result as boolean;
  }

  async toggle(automationId: string, processId: number): Promise<boolean> {
    const result = await this.call('toggle', { automationId, processId });
    return result as boolean;
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  async sendKeys(keys: string): Promise<void> {
    // UIA does not directly support keystroke injection.
    // Use PowerShell's System.Windows.Forms.SendKeys as a platform-native
    // approach. The keys string uses .NET SendKeys format:
    //   https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.sendkeys
    const escaped = keys.replace(/'/g, "''");
    const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`;

    await new Promise<void>((resolve, reject) => {
      const child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
        stdio: 'ignore',
        windowsHide: true,
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`sendKeys: powershell exited with code ${code}`));
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Internal JSON-RPC plumbing
  // ---------------------------------------------------------------------------

  /**
   * High-level call: validates readiness, sends request, returns typed result.
   */
  private async call(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.ready || !this.process) {
      throw new Error(`UIABridge: adapter not ready (call to "${method}")`);
    }
    return this.sendRequest(method, params);
  }

  /**
   * Low-level: writes a JSON-RPC request to stdin and returns a promise that
   * resolves when the matching response arrives on stdout.
   */
  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const id = this.nextId++;

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`UIABridge: request ${id} ("${method}") timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });

      const request: JsonRpcRequest = { method, params, id };
      const line = JSON.stringify(request) + '\n';

      try {
        this.process!.stdin!.write(line);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error(`UIABridge: failed to write to stdin: ${(err as Error).message}`));
      }
    });
  }

  /**
   * Handles a single line of JSON from the adapter's stdout.
   */
  private handleResponseLine(line: string): void {
    if (!line.trim()) return;

    let response: JsonRpcResponse;
    try {
      response = JSON.parse(line) as JsonRpcResponse;
    } catch {
      if (process.env.UIA_BRIDGE_DEBUG) {
        process.stderr.write(`[uia-bridge] unparseable response: ${line}\n`);
      }
      return;
    }

    const pending = this.pending.get(response.id);
    if (!pending) {
      if (process.env.UIA_BRIDGE_DEBUG) {
        process.stderr.write(`[uia-bridge] no pending request for id ${response.id}\n`);
      }
      return;
    }

    this.pending.delete(response.id);
    clearTimeout(pending.timer);

    if (response.error) {
      pending.reject(new Error(`UIABridge RPC error (${response.error.code}): ${response.error.message}`));
    } else {
      pending.resolve(response.result);
    }
  }
}
