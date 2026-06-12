/**
 * NVDABridge — HTTP client for the NVDA brailleBridge add-on.
 *
 * Communicates with the NVDA add-on's HTTP server on localhost:8889
 * to send navigation commands and read braille/speech output.
 */

import type { NavigationCommand } from '../types/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NVDABrailleState {
  displayText: string;
  fullText: string;
  displaySize: number;
  cursorPos: number | null;
  regions: NVDARegion[];
  cellCount: number;
  truncated: boolean;
}

export interface NVDARegion {
  text: string;
  type: string;
  role?: string;
  name?: string;
  value?: string;
}

export interface NVDANavigateResult {
  success: boolean;
  braille: NVDABrailleState;
  speech: string;
  action: string;
  error?: string;
}

export interface NVDAStatus {
  running: boolean;
  focus: {
    name: string;
    role: string;
    value: string;
    description: string;
    appModule: string;
  };
  treeInterceptor?: {
    hasTreeInterceptor?: boolean;
    passThrough?: boolean | null;
    tiType?: string;
  };
  brailleDisplaySize: number;
  brailleEnabled: boolean;
}

// ---------------------------------------------------------------------------
// JAWS → NVDA key mapping
// ---------------------------------------------------------------------------

const JAWS_KEY_TO_ELEMENT: Record<string, string> = {
  h: 'heading',
  '1': 'heading1', '2': 'heading2', '3': 'heading3',
  '4': 'heading4', '5': 'heading5', '6': 'heading6',
  r: 'landmark',
  u: 'link',
  v: 'link',
  q: 'landmark',  // JAWS main → NVDA landmark
  l: 'list',
  i: 'listitem',
  f: 'formfield',
  e: 'edit',
  b: 'button',
  t: 'table',
  g: 'graphic',
  x: 'checkbox',
  a: 'radiobutton',
  c: 'combobox',
  n: 'text',
  p: 'paragraph',
  d: 'landmark',
};

// ---------------------------------------------------------------------------
// NVDABridge class
// ---------------------------------------------------------------------------

export class NVDABridge {
  private baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:8889') {
    this.baseUrl = baseUrl;
  }

  /**
   * Wait for the NVDA add-on to be ready.
   */
  async waitForReady(timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await fetch(`${this.baseUrl}/health`);
        if (res.ok) return;
      } catch {}
      await sleep(500);
    }
    throw new Error('NVDA brailleBridge not responding');
  }

  /**
   * Wait for NVDA to be focused on a Chromium/Chrome browser.
   */
  async waitForBrowserFocus(timeoutMs = 15000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const status = await this.getStatus();
        const app = status.focus.appModule?.toLowerCase() ?? '';
        if (app.includes('chrome') || app.includes('chromium') || app.includes('msedge')) {
          return;
        }
      } catch {}
      await sleep(500);
    }
    throw new Error('NVDA not focused on browser window');
  }

  /**
   * Get current braille display state.
   */
  async getBraille(): Promise<NVDABrailleState> {
    const res = await fetch(`${this.baseUrl}/braille`);
    return res.json() as Promise<NVDABrailleState>;
  }

  /**
   * Get last speech output.
   */
  async getSpeech(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/speech`);
    const data = await res.json() as { lastSpeech: string };
    return data.lastSpeech;
  }

  /**
   * Get NVDA status.
   */
  async getStatus(): Promise<NVDAStatus> {
    const res = await fetch(`${this.baseUrl}/status`);
    return res.json() as Promise<NVDAStatus>;
  }

  /**
   * Execute a navigation command via the NVDA add-on.
   * Translates our NavigationCommand to NVDA's action format.
   */
  async navigate(cmd: NavigationCommand, delayMs = 400): Promise<NVDANavigateResult> {
    const body = this.translateCommand(cmd, delayMs);
    const res = await fetch(`${this.baseUrl}/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<NVDANavigateResult>;
  }

  /**
   * Send raw keystrokes to NVDA.
   */
  async sendKeys(keys: string[], delayMs = 300): Promise<NVDABrailleState> {
    const res = await fetch(`${this.baseUrl}/sendkeys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys, delayMs }),
    });
    const data = await res.json() as { braille: NVDABrailleState };
    return data.braille;
  }

  /**
   * Translate a NavigationCommand to NVDA add-on POST body.
   */
  private translateCommand(cmd: NavigationCommand, delayMs: number): Record<string, unknown> {
    switch (cmd.type) {
      case 'quickNav': {
        const element = JAWS_KEY_TO_ELEMENT[cmd.key] ?? '';
        return {
          action: 'quickNav',
          element,
          jawsKey: cmd.key,
          direction: cmd.direction === 'forward' ? 'next' : 'previous',
          delayMs,
        };
      }

      case 'move':
        return {
          action: 'moveLine',
          direction: cmd.direction === 'down' ? 'next' : 'previous',
          delayMs,
        };

      case 'read':
        return { action: 'readLine', delayMs };

      case 'activate':
        return { action: 'activate', delayMs };

      case 'tab':
        return {
          action: 'tab',
          direction: cmd.direction === 'forward' ? 'next' : 'previous',
          delayMs,
        };

      case 'escape':
        return { action: 'escape', delayMs };

      case 'enterFormsMode':
      case 'exitFormsMode':
        return { action: 'toggleMode', delayMs };

      case 'pan':
        return {
          action: cmd.direction === 'right' ? 'panRight' : 'panLeft',
          delayMs,
        };

      case 'refreshBuffer':
        return { action: 'refreshBuffer', delayMs };

      case 'find':
        return { action: 'find', text: cmd.text, delayMs: Math.max(delayMs, 800) };

      case 'typeText':
        return { action: 'typeText', text: cmd.text, delayMs };

      case 'toggle':
        return { action: 'activate', delayMs }; // Space/Enter

      case 'elementList':
        // Element lists open NVDA dialogs — we handle this at the agent level
        // by cycling through elements with quick nav instead.
        return { action: 'readLine', delayMs };

      default:
        return { action: 'readLine', delayMs };
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
