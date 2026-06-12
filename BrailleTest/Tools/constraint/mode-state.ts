/**
 * Browse Mode / Forms Mode state machine.
 *
 * JAWS operates in two mutually exclusive modes:
 *
 * - Browse Mode: The virtual buffer is active. Quick navigation keys
 *   (H, B, E, T, etc.) move between elements. Typing is intercepted
 *   as navigation commands.
 *
 * - Forms Mode: The virtual buffer is suspended. Keystrokes pass
 *   through to the focused form control. Quick navigation is disabled.
 *
 * JAWS auto-switches to Forms Mode when the user presses Enter on
 * certain interactive elements (edit boxes, combo boxes). The user
 * returns to Browse Mode with Numpad+ or Escape.
 */

import type { NavigationCommand } from '../types/index.js';

/** Commands that require Browse Mode (virtual buffer active). */
const BROWSE_ONLY_COMMANDS: ReadonlySet<string> = new Set([
  'quickNav',
  'elementList',
  'read',
  'move',
  'find',
]);

/** Commands that require Forms Mode (passthrough active). */
const FORMS_ONLY_COMMANDS: ReadonlySet<string> = new Set([
  'typeText',
]);

/** Commands valid in either mode. */
const UNIVERSAL_COMMANDS: ReadonlySet<string> = new Set([
  'pan',
  'routeCursor',
  'activate',
  'toggle',
  'escape',
  'tab',
  'enterFormsMode',
  'exitFormsMode',
  'refreshBuffer',
]);

/** Element types that trigger JAWS auto-switch to Forms Mode. */
const AUTO_SWITCH_TYPES: ReadonlySet<string> = new Set([
  'edit',
  'combobox',
]);

export interface ModeState {
  currentMode: 'browse' | 'forms';
}

/**
 * Creates a fresh mode state. JAWS always starts in Browse Mode.
 */
export function createModeState(): ModeState {
  return { currentMode: 'browse' };
}

/**
 * Transitions to Forms Mode.
 *
 * @returns An announcement string mimicking what JAWS would speak/display,
 *          or null if already in Forms Mode.
 */
export function enterFormsMode(state: ModeState): string | null {
  if (state.currentMode === 'forms') {
    return null;
  }
  state.currentMode = 'forms';
  return 'Forms mode on';
}

/**
 * Transitions to Browse Mode.
 *
 * @returns An announcement string mimicking what JAWS would speak/display,
 *          or null if already in Browse Mode.
 */
export function exitFormsMode(state: ModeState): string | null {
  if (state.currentMode === 'browse') {
    return null;
  }
  state.currentMode = 'browse';
  return 'Forms mode off';
}

/**
 * Validates whether a navigation command is legal in the current mode.
 *
 * @returns An object with `valid` (boolean) and, if invalid, a `reason` string
 *          explaining why the command was rejected.
 */
export function isCommandValid(
  command: NavigationCommand,
  currentMode: 'browse' | 'forms',
): { valid: boolean; reason?: string } {
  const commandType = command.type;

  // Universal commands work in any mode
  if (UNIVERSAL_COMMANDS.has(commandType)) {
    return { valid: true };
  }

  // Browse-only commands rejected in Forms Mode
  if (BROWSE_ONLY_COMMANDS.has(commandType) && currentMode === 'forms') {
    return {
      valid: false,
      reason: `Command "${commandType}" requires Browse Mode. Currently in Forms Mode. Exit with Numpad+ or Escape first.`,
    };
  }

  // Forms-only commands rejected in Browse Mode
  if (FORMS_ONLY_COMMANDS.has(commandType) && currentMode === 'browse') {
    return {
      valid: false,
      reason: `Command "${commandType}" requires Forms Mode. Currently in Browse Mode. Enter Forms Mode first (press Enter on a form field).`,
    };
  }

  return { valid: true };
}

/**
 * Determines whether JAWS would auto-switch to Forms Mode for this
 * element type when the user presses Enter on it.
 *
 * @param elementType - The element type key (e.g. "edit", "combobox", "button").
 * @returns true if JAWS would auto-switch to Forms Mode.
 */
export function shouldAutoSwitch(elementType: string): boolean {
  return AUTO_SWITCH_TYPES.has(elementType.toLowerCase());
}
