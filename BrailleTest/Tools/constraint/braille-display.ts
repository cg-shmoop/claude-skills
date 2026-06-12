/**
 * 40-cell braille display simulator.
 *
 * Models a refreshable braille display as the sole output channel.
 * In Structured Mode, each line is prefixed with the element type
 * abbreviation (btn, edt, lnk, h2, etc.) followed by a space,
 * then the element's accessible name. The result is padded or
 * truncated to exactly 40 characters. Content longer than 40 chars
 * requires panning.
 */

import type { BrailleView, BrailleDisplay } from '../types/index.js';
import { BRAILLE_ABBREVIATIONS } from '../types/index.js';

const DEFAULT_CELLS = 40;

/**
 * Creates a fresh BrailleDisplay state with defaults.
 */
export function createDisplay(cells: number = DEFAULT_CELLS): BrailleDisplay {
  return {
    cells,
    currentContent: ''.padEnd(cells, ' '),
    fullLine: '',
    panPosition: 0,
    structuredMode: true,
  };
}

/**
 * Renders content as it would appear on a braille display in Structured Mode.
 *
 * Format: "<abbreviation> <content>" padded/truncated to `cells` characters.
 * If the element type has no abbreviation (e.g. plain text), only the content
 * is shown. The returned BrailleView represents the first pan window.
 *
 * @param content     - The accessible name / text content of the element.
 * @param elementType - The element type key (e.g. "button", "edit", "link", "heading2").
 * @param mode        - Current interaction mode ('browse' or 'forms').
 * @param display     - The current display state (mutated in place and returned).
 * @returns A BrailleView snapshot of the first pan window.
 */
export function renderForBraille(
  content: string,
  elementType: string,
  mode: 'browse' | 'forms',
  display: BrailleDisplay,
): BrailleView {
  const abbreviation = BRAILLE_ABBREVIATIONS[elementType] ?? '';
  const fullLine = abbreviation
    ? `${abbreviation} ${content}`
    : content;

  // Update display state
  display.fullLine = fullLine;
  display.panPosition = 0;

  return buildView(display, abbreviation, content, mode);
}

/**
 * Pans the display left or right by one full screen width.
 *
 * @returns A new BrailleView at the updated pan position,
 *          or null if panning would go out of bounds.
 */
export function pan(
  direction: 'left' | 'right',
  display: BrailleDisplay,
  elementType: string,
  elementName: string,
  mode: 'browse' | 'forms',
): BrailleView | null {
  const maxOffset = Math.max(0, display.fullLine.length - display.cells);

  if (direction === 'right') {
    const next = display.panPosition + display.cells;
    if (next > maxOffset && display.panPosition >= maxOffset) {
      return null; // Already at the end
    }
    display.panPosition = Math.min(next, maxOffset);
  } else {
    if (display.panPosition === 0) {
      return null; // Already at the start
    }
    display.panPosition = Math.max(0, display.panPosition - display.cells);
  }

  const abbreviation = BRAILLE_ABBREVIATIONS[elementType] ?? '';
  return buildView(display, abbreviation, elementName, mode);
}

/**
 * Routes the cursor to a specific cell index and returns what
 * character/element is at that position in the full line.
 *
 * @param cellIndex - 0-based cell position on the display (0..cells-1).
 * @returns The character at that position, or null if out of bounds.
 */
export function routeCursor(
  cellIndex: number,
  display: BrailleDisplay,
): { character: string; absoluteIndex: number } | null {
  if (cellIndex < 0 || cellIndex >= display.cells) {
    return null;
  }

  const absoluteIndex = display.panPosition + cellIndex;
  if (absoluteIndex >= display.fullLine.length) {
    return { character: ' ', absoluteIndex };
  }

  return {
    character: display.fullLine[absoluteIndex],
    absoluteIndex,
  };
}

/**
 * Returns the current BrailleView without changing any state.
 */
export function getCurrentView(
  display: BrailleDisplay,
  elementType: string,
  elementName: string,
  mode: 'browse' | 'forms',
): BrailleView {
  const abbreviation = BRAILLE_ABBREVIATIONS[elementType] ?? '';
  return buildView(display, abbreviation, elementName, mode);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds a BrailleView from the current display state.
 */
function buildView(
  display: BrailleDisplay,
  abbreviation: string,
  elementName: string,
  mode: 'browse' | 'forms',
): BrailleView {
  const { cells, fullLine, panPosition } = display;

  // Extract the visible window
  const windowText = fullLine.substring(panPosition, panPosition + cells);

  // Pad to exactly `cells` characters
  const displayedText = windowText.padEnd(cells, ' ');

  // Update the display's current content
  display.currentContent = displayedText;

  const truncated = fullLine.length > cells;
  const totalPans = truncated ? Math.ceil(fullLine.length / cells) : 1;
  const currentPan = Math.floor(panPosition / cells) + 1;

  return {
    displayedText,
    truncated,
    panPosition,
    totalPans,
    currentPan,
    elementType: abbreviation,
    elementName,
    mode,
  };
}
