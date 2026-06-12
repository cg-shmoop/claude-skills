/**
 * Navigation command types and strategy definitions.
 * Models how the agent navigates using JAWS keyboard commands.
 */

import type { BrailleView } from './braille.js';

// --- Navigation Commands ---

export type NavigationCommand =
  | QuickNavCommand
  | ElementListCommand
  | ReadCommand
  | MoveCommand
  | PanCommand
  | RouteCursorCommand
  | ActivateCommand
  | ToggleCommand
  | EscapeCommand
  | TabCommand
  | EnterFormsModeCommand
  | ExitFormsModeCommand
  | RefreshBufferCommand
  | FindCommand
  | TypeTextCommand;

export interface QuickNavCommand {
  type: 'quickNav';
  key: QuickNavKey;
  direction: 'forward' | 'backward';
}

export interface ElementListCommand {
  type: 'elementList';
  listType: ElementListType;
}

export interface ReadCommand {
  type: 'read';
  unit: 'character' | 'word' | 'line' | 'all';
}

export interface MoveCommand {
  type: 'move';
  direction: 'up' | 'down' | 'left' | 'right';
}

export interface PanCommand {
  type: 'pan';
  direction: 'left' | 'right';
}

export interface RouteCursorCommand {
  type: 'routeCursor';
  cellIndex: number;
}

export interface ActivateCommand {
  type: 'activate';
}

export interface ToggleCommand {
  type: 'toggle';
}

export interface EscapeCommand {
  type: 'escape';
}

export interface TabCommand {
  type: 'tab';
  direction: 'forward' | 'backward';
}

export interface EnterFormsModeCommand {
  type: 'enterFormsMode';
}

export interface ExitFormsModeCommand {
  type: 'exitFormsMode';
}

export interface RefreshBufferCommand {
  type: 'refreshBuffer';
}

export interface FindCommand {
  type: 'find';
  text: string;
}

export interface TypeTextCommand {
  type: 'typeText';
  text: string;
  masked?: boolean; // true for password fields
}

// --- Quick Navigation Keys ---

export type QuickNavKey =
  | 'h' | '1' | '2' | '3' | '4' | '5' | '6'  // Headings
  | 'r' | 'q'                                    // Landmarks
  | 'f' | 'e' | 'b' | 'c' | 'a' | 'x'          // Forms
  | 't'                                           // Tables
  | 'u' | 'v'                                     // Links
  | 'l' | 'i'                                     // Lists
  | 'g' | 'n' | 'p' | 'd';                        // Other

/** Human-readable descriptions of quick nav keys */
export const QUICK_NAV_DESCRIPTIONS: Record<QuickNavKey, string> = {
  h: 'Next heading (any level)',
  '1': 'Next heading level 1',
  '2': 'Next heading level 2',
  '3': 'Next heading level 3',
  '4': 'Next heading level 4',
  '5': 'Next heading level 5',
  '6': 'Next heading level 6',
  r: 'Next landmark/region',
  q: 'Jump to main content region',
  f: 'Next form field (any type)',
  e: 'Next edit box (text input)',
  b: 'Next button',
  c: 'Next combo box (dropdown)',
  a: 'Next radio button',
  x: 'Next checkbox',
  t: 'Next table',
  u: 'Next unvisited link',
  v: 'Next visited link',
  l: 'Next list',
  i: 'Next list item',
  g: 'Next graphic (image)',
  n: 'Next non-link text block',
  p: 'Next paragraph',
  d: 'Next element of different type',
};

export type ElementListType =
  | 'headings'    // INSERT+F6
  | 'links'       // INSERT+F7
  | 'formFields'  // INSERT+F5
  | 'tables'      // CTRL+INSERT+T
  | 'buttons'     // CTRL+INSERT+B
  | 'graphics'    // CTRL+INSERT+G
  | 'landmarks'   // CTRL+INSERT+R
  | 'all';        // INSERT+F3

/** JAWS keystroke equivalents for element lists */
export const ELEMENT_LIST_KEYSTROKES: Record<ElementListType, string> = {
  headings: 'INSERT+F6',
  links: 'INSERT+F7',
  formFields: 'INSERT+F5',
  tables: 'CTRL+INSERT+T',
  buttons: 'CTRL+INSERT+B',
  graphics: 'CTRL+INSERT+G',
  landmarks: 'CTRL+INSERT+R',
  all: 'INSERT+F3',
};

// --- Command Results ---

export interface CommandResult {
  command: NavigationCommand;
  brailleView: BrailleView;
  elementReached: ElementInfo | null;
  modeAfter: 'browse' | 'forms';
  announcements: string[];
  liveRegionUpdates: string[];
  success: boolean;
  error?: string;
}

export interface ElementInfo {
  automationId: string;
  controlType: number;
  controlTypeName: string;
  name: string;
  value: string;
  role: string;
  ariaRole: string;
  level: number;
  positionInSet: number;
  sizeOfSet: number;
  isEnabled: boolean;
  isKeyboardFocusable: boolean;
  hasKeyboardFocus: boolean;
  isRequired: boolean;
  isPassword: boolean;
  states: string[];
  description: string;
  helpText: string;
  landmarkType: string;
}

// --- Strategies ---

export interface NavigationStrategy {
  name: string;
  description: string;
  steps: NavigationStep[];
}

export interface NavigationStep {
  action: string;
  command: NavigationCommand | null; // null = orchestrator provides dynamically
  description?: string;
  repeatUntil?: string; // condition for repeating this step
}

// --- Command-to-keystroke mapping ---

/** Maps a NavigationCommand to the JAWS keystroke string for logging */
export function commandToKeystroke(cmd: NavigationCommand): string {
  switch (cmd.type) {
    case 'quickNav':
      return cmd.direction === 'forward'
        ? cmd.key.toUpperCase()
        : `Shift+${cmd.key.toUpperCase()}`;
    case 'elementList':
      return ELEMENT_LIST_KEYSTROKES[cmd.listType];
    case 'read':
      switch (cmd.unit) {
        case 'character': return 'Right Arrow';
        case 'word': return 'INSERT+Right Arrow';
        case 'line': return 'INSERT+Up Arrow';
        case 'all': return 'INSERT+Down Arrow';
      }
      break;
    case 'move':
      return `${cmd.direction.charAt(0).toUpperCase() + cmd.direction.slice(1)} Arrow`;
    case 'pan':
      return `Pan ${cmd.direction}`;
    case 'routeCursor':
      return `Cursor Route cell ${cmd.cellIndex}`;
    case 'activate':
      return 'Enter';
    case 'toggle':
      return 'Space';
    case 'escape':
      return 'Escape';
    case 'tab':
      return cmd.direction === 'forward' ? 'Tab' : 'Shift+Tab';
    case 'enterFormsMode':
      return 'Enter (on form field)';
    case 'exitFormsMode':
      return 'Numpad+ / Escape';
    case 'refreshBuffer':
      return 'INSERT+Escape';
    case 'find':
      return `Ctrl+F "${cmd.text}"`;
    case 'typeText':
      return cmd.masked ? 'Type [password]' : `Type "${cmd.text}"`;
  }
  return 'Unknown';
}

/** Human-readable description of what a command does */
export function commandToDescription(cmd: NavigationCommand): string {
  switch (cmd.type) {
    case 'quickNav':
      const dir = cmd.direction === 'forward' ? 'Next' : 'Previous';
      return `${dir} ${QUICK_NAV_DESCRIPTIONS[cmd.key]}`;
    case 'elementList':
      return `Open ${cmd.listType} list (${ELEMENT_LIST_KEYSTROKES[cmd.listType]})`;
    case 'read':
      return `Read current ${cmd.unit}`;
    case 'move':
      return `Move ${cmd.direction}`;
    case 'pan':
      return `Pan braille display ${cmd.direction}`;
    case 'routeCursor':
      return `Route cursor to cell ${cmd.cellIndex}`;
    case 'activate':
      return 'Activate (Enter)';
    case 'toggle':
      return 'Toggle (Space)';
    case 'escape':
      return 'Escape';
    case 'tab':
      return cmd.direction === 'forward' ? 'Tab to next focusable' : 'Shift+Tab to previous focusable';
    case 'enterFormsMode':
      return 'Enter Forms Mode';
    case 'exitFormsMode':
      return 'Exit Forms Mode (back to Browse Mode)';
    case 'refreshBuffer':
      return 'Refresh virtual buffer';
    case 'find':
      return `Find text: "${cmd.text}"`;
    case 'typeText':
      return cmd.masked ? 'Type password' : `Type "${cmd.text}"`;
  }
}
