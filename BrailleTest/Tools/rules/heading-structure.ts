/**
 * Heading Structure Rule
 *
 * Evaluates heading hierarchy from the braille user's perspective.
 * Without headings, braille users must read linearly through entire pages
 * since the H quick-nav key produces no results.
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

export const headingStructureRule: AssessmentRule = {
  id: 'heading-structure',
  name: 'Heading Structure',
  description:
    'Checks that the page has a logical heading hierarchy so braille users can navigate by heading (H key) efficiently.',
  wcagCriteria: ['1.3.1', '2.4.6'],

  evaluate(context: AssessmentContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];
    const { headings } = context.pageModel;

    // No headings at all - forces 100% linear reading
    if (headings.length === 0) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'missing_heading_structure',
        severity: 'critical',
        wcagCriteria: ['1.3.1', '2.4.6'],
        title: 'Page has no headings',
        description:
          'The page contains zero headings. A braille user pressing H to navigate by heading receives no response, forcing them to read the entire page linearly character by character or line by line.',
        brailleExperience:
          'Pressing H produces no movement. User must pan through entire page content sequentially.',
        expectedExperience:
          'Pressing H should jump to the next heading, showing e.g. "h1 Page Title" on the braille display.',
        elementPath: 'document',
        panCount: 0,
        navigationCost: makeCost({
          frustrationIndex: 10,
          timeEstimate: 120,
        }),
        reproducibility: 'Press H in browse mode anywhere on the page. No heading is reached.',
        axeCoreOverlap: true,
      });
      return findings;
    }

    // No h1 present
    const hasH1 = headings.some((h) => h.level === 1);
    if (!hasH1) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'missing_heading_structure',
        severity: 'serious',
        wcagCriteria: ['1.3.1', '2.4.6'],
        title: 'No level 1 heading found',
        description:
          'The page has no h1 element. Braille users pressing 1 to jump to the primary heading receive no response, making it hard to confirm the page purpose.',
        brailleExperience:
          'Pressing 1 (quick-nav for h1) produces no movement. The page purpose is unclear from heading navigation alone.',
        expectedExperience:
          'Pressing 1 should jump to the primary page heading, showing "h1 [Page Title]" on the display.',
        elementPath: 'document',
        panCount: 0,
        navigationCost: makeCost({
          frustrationIndex: 6,
          timeEstimate: 15,
        }),
        reproducibility: 'Press 1 in browse mode. No h1 heading is reached.',
        axeCoreOverlap: true,
      });
    }

    // Check for heading level skips (e.g., h1 -> h3 with no h2)
    const sortedHeadings = [...headings].sort((a, b) => {
      // Sort by document order (use the order they appear in the array)
      return headings.indexOf(a) - headings.indexOf(b);
    });

    for (let i = 1; i < sortedHeadings.length; i++) {
      const prev = sortedHeadings[i - 1];
      const curr = sortedHeadings[i];

      // A skip occurs when the current level is more than 1 deeper than the previous
      if (curr.level > prev.level + 1) {
        const skippedLevels: number[] = [];
        for (let level = prev.level + 1; level < curr.level; level++) {
          skippedLevels.push(level);
        }

        findings.push({
          id: crypto.randomUUID(),
          type: 'missing_heading_structure',
          severity: 'moderate',
          wcagCriteria: ['1.3.1', '2.4.6'],
          title: `Heading level skip: h${prev.level} to h${curr.level}`,
          description:
            `Heading jumps from h${prev.level} ("${prev.text}") to h${curr.level} ("${curr.text}"), ` +
            `skipping level${skippedLevels.length > 1 ? 's' : ''} ${skippedLevels.join(', ')}. ` +
            `Braille users navigating by heading level may miss content organized under the skipped levels.`,
          brailleExperience:
            `Pressing ${skippedLevels[0]} (quick-nav for h${skippedLevels[0]}) skips over this section entirely. ` +
            `Content between h${prev.level} and h${curr.level} may be missed.`,
          expectedExperience:
            `Intermediate h${skippedLevels[0]} headings should exist so pressing ${skippedLevels[0]} moves through the content hierarchy logically.`,
          elementPath: curr.automationId || `heading[${i}]`,
          panCount: 0,
          navigationCost: makeCost({
            frustrationIndex: 4,
            timeEstimate: 10,
          }),
          reproducibility:
            `Press ${skippedLevels[0]} in browse mode after reaching h${prev.level} "${prev.text}". No h${skippedLevels[0]} is found before h${curr.level}.`,
          axeCoreOverlap: true,
        });
      }
    }

    // Only one heading on the entire page
    if (headings.length === 1) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'missing_heading_structure',
        severity: 'minor',
        wcagCriteria: ['1.3.1', '2.4.6'],
        title: 'Page has only one heading',
        description:
          'The page contains a single heading. While acceptable for simple pages (e.g., login), most pages benefit from multiple headings to allow braille users to jump between content sections.',
        brailleExperience:
          'Pressing H once reaches the sole heading. Pressing H again wraps back to the same heading. No section navigation is possible.',
        expectedExperience:
          'Pressing H repeatedly should move through multiple section headings, allowing quick content scanning.',
        elementPath: headings[0].automationId || 'heading[0]',
        panCount: 0,
        navigationCost: makeCost({
          frustrationIndex: 2,
          timeEstimate: 5,
        }),
        reproducibility:
          'Press H twice in browse mode. The second press wraps to the same heading.',
        axeCoreOverlap: false,
      });
    }

    return findings;
  },
};
