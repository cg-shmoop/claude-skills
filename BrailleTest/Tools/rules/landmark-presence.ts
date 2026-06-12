/**
 * Landmark Presence Rule
 *
 * Evaluates ARIA landmark usage from the braille user's perspective.
 * Landmarks let braille users press R/Q to jump between page regions
 * instead of reading linearly through all content.
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

export const landmarkPresenceRule: AssessmentRule = {
  id: 'landmark-presence',
  name: 'Landmark Presence',
  description:
    'Checks that the page uses ARIA landmarks so braille users can jump between regions using R (next landmark) and Q (main content).',
  wcagCriteria: ['1.3.1', '2.4.1'],

  evaluate(context: AssessmentContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];
    const { landmarks } = context.pageModel;

    // No landmarks at all
    if (landmarks.length === 0) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'missing_landmark',
        severity: 'serious',
        wcagCriteria: ['1.3.1', '2.4.1'],
        title: 'Page has no ARIA landmarks',
        description:
          'The page defines no landmarks (main, navigation, banner, etc.). Braille users pressing R to jump between regions receive no response, eliminating region-based navigation entirely.',
        brailleExperience:
          'Pressing R produces no movement. Pressing Q (jump to main) produces no movement. The user has no way to skip to specific page regions.',
        expectedExperience:
          'Pressing R should jump between landmarks, showing e.g. "main rgn" or "nav rgn" on the braille display.',
        elementPath: 'document',
        panCount: 0,
        navigationCost: makeCost({
          frustrationIndex: 8,
          timeEstimate: 60,
        }),
        reproducibility:
          'Press R in browse mode. No landmark region is reached. Press Q. No main region is reached.',
        axeCoreOverlap: true,
      });
      return findings;
    }

    // Check for main landmark
    const mainLandmarkTypes = ['main'];
    const hasMain = landmarks.some(
      (l) => mainLandmarkTypes.includes(l.type.toLowerCase()),
    );

    if (!hasMain) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'missing_landmark',
        severity: 'serious',
        wcagCriteria: ['1.3.1', '2.4.1'],
        title: 'No main landmark found',
        description:
          'The page has no main landmark. Braille users pressing Q to jump directly to the primary content receive no response, forcing them to navigate past headers, navigation, and other preamble manually.',
        brailleExperience:
          'Pressing Q produces no movement. The user must press Down Arrow or H repeatedly to find where the main content begins.',
        expectedExperience:
          'Pressing Q should jump directly to the main content area, showing "main rgn [label]" on the braille display.',
        elementPath: 'document',
        panCount: 0,
        navigationCost: makeCost({
          commandCount: 15,
          panCount: 10,
          frustrationIndex: 7,
          timeEstimate: 30,
        }),
        reproducibility:
          'Press Q in browse mode from the top of the page. No main region is reached.',
        axeCoreOverlap: true,
      });
    }

    // Check for navigation landmark
    const hasNav = landmarks.some(
      (l) => l.type.toLowerCase() === 'navigation',
    );

    if (!hasNav) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'missing_landmark',
        severity: 'moderate',
        wcagCriteria: ['1.3.1', '2.4.1'],
        title: 'No navigation landmark found',
        description:
          'The page has no navigation landmark. Braille users cannot jump directly to the site navigation using R, making it harder to find and use navigation links.',
        brailleExperience:
          'Pressing R skips over navigation links because they are not wrapped in a nav landmark. User must find navigation by reading linearly.',
        expectedExperience:
          'Pressing R should reach a navigation landmark, showing "nav rgn [label]" on the braille display, grouping all navigation links.',
        elementPath: 'document',
        panCount: 0,
        navigationCost: makeCost({
          commandCount: 10,
          panCount: 5,
          frustrationIndex: 4,
          timeEstimate: 15,
        }),
        reproducibility:
          'Press R repeatedly in browse mode. No navigation region is encountered among the landmarks.',
        axeCoreOverlap: true,
      });
    }

    return findings;
  },
};
