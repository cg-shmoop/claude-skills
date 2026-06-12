/**
 * Form Labels Rule
 *
 * Evaluates form field labeling from the braille user's perspective.
 * On a braille display, an unlabeled edit field shows only "edt" with
 * no indication of what data to enter.
 */

import type {
  AssessmentRule,
  AssessmentContext,
  AccessibilityFinding,
  NavigationCost,
} from '../types/index.js';

function makeCost(overrides: Partial<NavigationCost> = {}): NavigationCost {
  return {
    commandCount: 0,
    panCount: 0,
    modeChanges: 0,
    timeEstimate: 0,
    frustrationIndex: 0,
    ...overrides,
  };
}

/** Labels that provide no real context */
const GENERIC_LABELS = new Set([
  'input',
  'field',
  'field1',
  'field2',
  'field3',
  'text',
  'textbox',
  'enter text',
  'type here',
  'input field',
  'form field',
  'edit',
  '',
]);

export const formLabelsRule: AssessmentRule = {
  id: 'form-labels',
  name: 'Form Labels',
  description:
    'Checks that form fields have meaningful accessible names so braille users know what data to enter when they encounter each field.',
  wcagCriteria: ['1.3.1', '3.3.2'],

  evaluate(context: AssessmentContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];
    const { formFields } = context.pageModel;

    for (const field of formFields) {
      const label = field.label.trim();

      // No accessible name at all
      if (label === '') {
        findings.push({
          id: crypto.randomUUID(),
          type: 'unlabeled_form_field',
          severity: 'critical',
          wcagCriteria: ['1.3.1', '3.3.2'],
          title: `Unlabeled ${field.type} field`,
          description:
            `A ${field.type} form field has no accessible name. On the braille display, the user sees only the field type abbreviation (e.g., "edt") with no indication of what information is expected.`,
          brailleExperience:
            `Display shows "edt" (or similar type abbreviation) with no label text. The user has no way to know what to type.`,
          expectedExperience:
            `Display should show "edt [Descriptive Label]" so the user knows the field's purpose before entering data.`,
          elementPath: field.automationId || `formField[${field.type}]`,
          panCount: 0,
          navigationCost: makeCost({
            commandCount: 2,
            frustrationIndex: 9,
            timeEstimate: 30,
          }),
          reproducibility:
            `Press F (next form field) or Tab to reach the field. The braille display shows only the control type with no label.`,
          axeCoreOverlap: true,
        });
        continue;
      }

      // Generic / non-descriptive label
      if (GENERIC_LABELS.has(label.toLowerCase())) {
        findings.push({
          id: crypto.randomUUID(),
          type: 'unlabeled_form_field',
          severity: 'serious',
          wcagCriteria: ['1.3.1', '3.3.2'],
          title: `Form field has generic label: "${label}"`,
          description:
            `A ${field.type} field is labeled "${label}" which provides no meaningful context. The braille user sees "edt ${label}" but cannot determine what data is expected.`,
          brailleExperience:
            `Display shows "edt ${label}" which does not convey the field's purpose.`,
          expectedExperience:
            `Display should show a descriptive label like "edt Email Address" or "edt First Name".`,
          elementPath: field.automationId || `formField[${field.type}]`,
          panCount: 0,
          navigationCost: makeCost({
            commandCount: 1,
            frustrationIndex: 6,
            timeEstimate: 15,
          }),
          reproducibility:
            `Press F or Tab to reach the field. The braille display shows "${label}" which is not descriptive.`,
          axeCoreOverlap: true,
        });
        continue;
      }

      // Password field that doesn't indicate it's a password
      if (
        field.type.toLowerCase() === 'password' &&
        !label.toLowerCase().includes('password') &&
        !label.toLowerCase().includes('pin') &&
        !label.toLowerCase().includes('passcode')
      ) {
        findings.push({
          id: crypto.randomUUID(),
          type: 'unlabeled_form_field',
          severity: 'moderate',
          wcagCriteria: ['1.3.1', '3.3.2'],
          title: `Password field label does not indicate password: "${label}"`,
          description:
            `A password field is labeled "${label}" without any indication that it expects a password. ` +
            `Braille users may not realize input will be masked, or may confuse it with a regular text field.`,
          brailleExperience:
            `Display shows "edt ${label}" with no password indicator. The user may not know input is masked.`,
          expectedExperience:
            `Display should show "edt Password" or "edt ${label} (password)" so the user knows this is a masked field.`,
          elementPath: field.automationId || `formField[password]`,
          panCount: 0,
          navigationCost: makeCost({
            commandCount: 1,
            frustrationIndex: 4,
            timeEstimate: 10,
          }),
          reproducibility:
            `Press F or Tab to reach the password field. The label "${label}" does not mention password.`,
          axeCoreOverlap: false,
        });
      }
    }

    return findings;
  },
};
