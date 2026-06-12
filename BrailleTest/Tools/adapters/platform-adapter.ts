import type { ElementInfo } from '../types/index.js';

/**
 * Abstract interface for platform-specific UI Automation adapters.
 * On Windows, this is implemented by UIABridge which communicates
 * with the C# BrailleTestAdapter subprocess over JSON-RPC/stdio.
 */
export interface PlatformAdapter {
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  isReady(): boolean;

  // Tree navigation
  getFocusedElement(): Promise<ElementInfo | null>;
  getRootElement(processId: number): Promise<ElementInfo | null>;
  getChildren(automationId: string, processId: number): Promise<ElementInfo[]>;

  // Element search
  findAll(processId: number, property: string, value: string): Promise<ElementInfo[]>;
  findFirst(processId: number, property: string, value: string): Promise<ElementInfo | null>;

  // Interaction
  invoke(automationId: string, processId: number): Promise<boolean>;
  setValue(automationId: string, value: string, processId: number): Promise<boolean>;
  toggle(automationId: string, processId: number): Promise<boolean>;

  // Keyboard
  sendKeys(keys: string): Promise<void>;
}
