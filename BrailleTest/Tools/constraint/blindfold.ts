/**
 * The Blindfold -- constitutional constraint enforcer.
 *
 * This module is the single gate between raw UIA element data and the
 * BrailleTest agent. It strips every property that a blind braille
 * display user cannot perceive: no coordinates, no class names, no CSS,
 * no colors, no dimensions. Only the accessibility tree properties that
 * map to braille output survive.
 *
 * If the agent tries to access a prohibited property, it is blocked.
 * This is not a suggestion -- it is a hard constitutional constraint.
 */

import type { ElementInfo } from '../types/index.js';

/**
 * The subset of element information available to a braille display user.
 * This is everything the agent is allowed to know about an element.
 * Nothing else exists.
 */
export interface ConstrainedElement {
  /** Element control type name (e.g. "button", "edit", "link") */
  type: string;
  /** Accessible name */
  name: string;
  /** Current value (text content, selected option, etc.) */
  value: string;
  /** Accessibility states (e.g. "checked", "expanded", "disabled") */
  states: string[];
  /** Heading level, tree depth, etc. (0 if not applicable) */
  level: number;
  /** Position within a set (e.g. "3 of 5") -- 0 if not in a set */
  positionInSet: number;
  /** Size of the containing set -- 0 if not in a set */
  sizeOfSet: number;
  /** Whether the field is marked as required */
  required: boolean;
  /** Whether the field has a validation error */
  hasError: boolean;
  /** Accessible description (aria-describedby, title, etc.) */
  description: string;
}

/**
 * Properties that a braille user absolutely cannot perceive.
 * Any attempt to access these is a constraint violation.
 */
const PROHIBITED_PROPERTIES: ReadonlySet<string> = new Set([
  // Visual / spatial
  'boundingRectangle',
  'boundingRect',
  'bounds',
  'x',
  'y',
  'width',
  'height',
  'top',
  'left',
  'right',
  'bottom',
  'coordinates',
  'position',
  'size',
  'location',

  // Styling
  'className',
  'classList',
  'cssStyles',
  'css',
  'style',
  'styles',
  'computedStyle',
  'backgroundColor',
  'foregroundColor',
  'color',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'textDecoration',
  'opacity',
  'visibility',
  'display',
  'zIndex',

  // DOM implementation details
  'tagName',
  'innerHTML',
  'outerHTML',
  'childNodes',
  'parentNode',
  'xpath',
  'selector',
  'cssSelector',

  // Visual presentation
  'icon',
  'image',
  'imageSource',
  'backgroundImage',
  'border',
  'borderColor',
  'borderWidth',
  'margin',
  'padding',
  'boxShadow',
  'animation',
  'transition',
  'transform',
  'cursor',

  // Screen coordinates
  'clickablePoint',
  'screenRect',
  'nativeWindowHandle',
  'processId',
  'runtimeId',
]);

/**
 * Filters a raw UIA element down to only what a braille user can perceive.
 *
 * This is a lossy, one-way transformation. The visual world is gone.
 * What remains is the accessibility semantics: type, name, value, state.
 *
 * @param uiaElement - Raw element data from UIA or the accessibility tree.
 * @returns A ConstrainedElement containing only perceivable properties.
 */
export function filterElement(uiaElement: ElementInfo): ConstrainedElement {
  return {
    type: uiaElement.controlTypeName || uiaElement.role || '',
    name: uiaElement.name || '',
    value: uiaElement.value || '',
    states: Array.isArray(uiaElement.states) ? [...uiaElement.states] : [],
    level: uiaElement.level ?? 0,
    positionInSet: uiaElement.positionInSet ?? 0,
    sizeOfSet: uiaElement.sizeOfSet ?? 0,
    required: uiaElement.isRequired ?? false,
    hasError: uiaElement.states?.includes('hasError') ?? false,
    description: uiaElement.description || uiaElement.helpText || '',
  };
}

/**
 * Returns true if the named property is prohibited -- meaning a braille
 * user cannot perceive it and the agent must not access it.
 *
 * @param property - The property name to check.
 * @returns true if the property is prohibited.
 */
export function isProhibitedAccess(property: string): boolean {
  return PROHIBITED_PROPERTIES.has(property);
}
