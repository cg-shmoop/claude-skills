/**
 * Form completion strategy — used when the agent needs to log in
 * or fill out any form. Accepts a dynamic set of fields and generates
 * the full step sequence: list fields, navigate, fill, submit, read result.
 */

import type { NavigationStrategy, NavigationStep } from '../types/index.js';

export const FORM_COMPLETION_STRATEGY: NavigationStrategy = {
  name: 'form-completion',
  description:
    'Fill and submit a form. Lists fields for overview, navigates to each field, enters forms mode, types values, then submits.',
  steps: [
    // Static template — use createFormCompletionSteps() for real runs
    {
      action: 'listFormFields',
      command: { type: 'elementList', listType: 'formFields' } as const,
      description:
        'List all form fields (INSERT+F5) to get overview of what needs filling',
    },
    {
      action: 'navigateToFirstField',
      command: { type: 'quickNav', key: 'f', direction: 'forward' } as const,
      description: 'Navigate to the first form field (F key)',
    },
    {
      action: 'readLabel',
      command: { type: 'read', unit: 'line' } as const,
      description: 'Read the field label shown on the braille display',
    },
    {
      action: 'enterFormsMode',
      command: { type: 'enterFormsMode' } as const,
      description: 'Enter Forms Mode to allow typing into the field',
    },
    {
      action: 'typeValue',
      command: null,
      description:
        'Type the field value (provided dynamically by the orchestrator)',
    },
    {
      action: 'tabToNext',
      command: { type: 'tab', direction: 'forward' } as const,
      description: 'Tab to the next form field',
    },
    {
      action: 'findSubmitButton',
      command: { type: 'quickNav', key: 'b', direction: 'forward' } as const,
      description: 'Find the submit button (B key or reached via Tab)',
    },
    {
      action: 'activateSubmit',
      command: { type: 'activate' } as const,
      description: 'Activate the submit button (Enter)',
    },
    {
      action: 'readResultPage',
      command: { type: 'read', unit: 'line' } as const,
      description:
        'Read the result page after submission (triggers orientation on new page)',
    },
  ],
};

/**
 * Generate concrete navigation steps for a specific set of form fields.
 *
 * @param fields - Array of fields to fill, in order. Each has a label
 *   (used to verify the right field), a value to type, and an optional
 *   masked flag for password fields.
 * @returns NavigationStep[] ready for the orchestrator to execute.
 */
export function createFormCompletionSteps(
  fields: Array<{ label: string; value: string; masked?: boolean }>,
): NavigationStep[] {
  const steps: NavigationStep[] = [];

  // Step 1: List form fields for overview
  steps.push({
    action: 'listFormFields',
    command: { type: 'elementList', listType: 'formFields' },
    description:
      'List all form fields (INSERT+F5) to get overview of what needs filling',
  });

  // Navigate to the first form field using Tab (moves real browser focus)
  steps.push({
    action: 'tabToFirstField',
    command: { type: 'tab', direction: 'forward' },
    description: 'Tab to the first form field (moves real browser focus)',
  });

  // Per-field steps: Tab gives real focus, so we enter forms mode and type directly.
  // No need for quickNav (virtual-only) — Tab is both virtual AND real.
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const ordinal = i + 1;

    // For fields after the first, Tab to it (first field already reached above)
    if (i > 0) {
      steps.push({
        action: `tabToField_${ordinal}`,
        command: { type: 'tab', direction: 'forward' },
        description: `Tab to field ${ordinal} ("${field.label}")`,
      });
    }

    // Enter Forms Mode (will skip click if Tab already focused the field)
    steps.push({
      action: `enterFormsMode_${ordinal}`,
      command: { type: 'enterFormsMode' },
      description: `Enter Forms Mode on field ${ordinal} ("${field.label}")`,
    });

    // Type value
    steps.push({
      action: `typeValue_${ordinal}`,
      command: {
        type: 'typeText',
        text: field.value,
        masked: field.masked ?? false,
      },
      description: field.masked
        ? `Type password into field ${ordinal} ("${field.label}")`
        : `Type "${field.value}" into field ${ordinal} ("${field.label}")`,
    });

    // Exit forms mode after typing (required for browse-only commands that follow)
    steps.push({
      action: `exitFormsMode_${ordinal}`,
      command: { type: 'exitFormsMode' },
      description: `Exit Forms Mode after filling field ${ordinal}`,
    });
  }

  // Tab to submit button (moves real focus past form fields to submit)
  steps.push({
    action: 'tabToSubmit',
    command: { type: 'tab', direction: 'forward' },
    description: 'Tab to the submit button',
  });

  // Activate submit via Enter (Tab already focused it)
  steps.push({
    action: 'activateSubmit',
    command: { type: 'activate' },
    description: 'Activate the submit button (Enter)',
  });

  // Step 10: Read result page (orientation trigger)
  steps.push({
    action: 'readResultPage',
    command: { type: 'read', unit: 'line' },
    description:
      'Read the result page after submission (triggers orientation on new page)',
  });

  return steps;
}
