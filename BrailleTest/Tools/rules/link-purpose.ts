/**
 * Link Purpose Rule
 *
 * Evaluates link text quality from the braille user's perspective.
 * On a 40-cell braille display, links are often navigated via quick-nav (U key)
 * or the links list (INSERT+F7). Generic link text like "Click here" or "Read more"
 * provides no context when encountered out of surrounding content.
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

/** Link text patterns that are generic and non-descriptive */
const GENERIC_LINK_TEXTS = new Set([
  'click here',
  'here',
  'read more',
  'learn more',
  'more',
  'link',
  'click',
  'go',
  'details',
  'more details',
  'more info',
  'more information',
  'continue',
  'continue reading',
]);

/** Simple heuristic: does the text look like a raw URL? */
function looksLikeUrl(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('www.') ||
    /^[a-z0-9-]+\.[a-z]{2,}(\/|$)/.test(trimmed)
  );
}

export const linkPurposeRule: AssessmentRule = {
  id: 'link-purpose',
  name: 'Link Purpose',
  description:
    'Checks that links have descriptive text so braille users can understand each link\'s destination when navigating via quick-nav or the links list.',
  wcagCriteria: ['2.4.4'],

  evaluate(context: AssessmentContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];
    const { links } = context.pageModel;

    // Track link text occurrences for duplicate detection
    const linkTextCounts = new Map<string, number>();
    for (const link of links) {
      const normalized = link.text.trim().toLowerCase();
      linkTextCounts.set(normalized, (linkTextCounts.get(normalized) || 0) + 1);
    }

    // Check for links with no text at all
    for (const link of links) {
      const text = link.text.trim();

      if (text === '') {
        findings.push({
          id: crypto.randomUUID(),
          type: 'non_descriptive_link',
          severity: 'critical',
          wcagCriteria: ['2.4.4'],
          title: 'Link has no accessible text',
          description:
            'A link has no text content or accessible name. On the braille display, the user sees only "lnk" with no indication of where the link goes or what it does.',
          brailleExperience:
            'Display shows "lnk" with no text. In the links list (INSERT+F7), it appears as a blank entry.',
          expectedExperience:
            'Display should show "lnk [Descriptive Text]" so the user knows the link destination.',
          elementPath: link.automationId || 'link[empty]',
          panCount: 0,
          navigationCost: makeCost({
            commandCount: 1,
            frustrationIndex: 9,
            timeEstimate: 20,
          }),
          reproducibility:
            'Press U (next unvisited link) to reach the link. The braille display shows "lnk" with no text.',
          axeCoreOverlap: true,
        });
        continue;
      }

      // Link text is just a URL
      if (looksLikeUrl(text)) {
        findings.push({
          id: crypto.randomUUID(),
          type: 'non_descriptive_link',
          severity: 'moderate',
          wcagCriteria: ['2.4.4'],
          title: `Link text is a raw URL: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`,
          description:
            `A link's text is a raw URL. On a 40-cell braille display, URLs require multiple pans to read and ` +
            `do not clearly convey the link's purpose. In the links list, it appears as an opaque URL string.`,
          brailleExperience:
            `Display shows "lnk ${text.substring(0, 36)}" requiring ${Math.ceil(text.length / 40)} pan(s) to read the full URL.`,
          expectedExperience:
            'Display should show "lnk [Human-Readable Description]" instead of a raw URL.',
          elementPath: link.automationId || `link[url]`,
          panCount: Math.max(0, Math.ceil(text.length / 40) - 1),
          navigationCost: makeCost({
            commandCount: 1,
            panCount: Math.max(0, Math.ceil(text.length / 40) - 1),
            frustrationIndex: 5,
            timeEstimate: 10,
          }),
          reproducibility:
            'Press U to reach the link. The braille display shows a URL that must be panned to read.',
          axeCoreOverlap: true,
        });
        continue;
      }
    }

    // Check for multiple links sharing generic text
    const reportedGenericTexts = new Set<string>();
    for (const link of links) {
      const normalized = link.text.trim().toLowerCase();
      if (
        GENERIC_LINK_TEXTS.has(normalized) &&
        (linkTextCounts.get(normalized) || 0) > 1 &&
        !reportedGenericTexts.has(normalized)
      ) {
        reportedGenericTexts.add(normalized);
        const count = linkTextCounts.get(normalized) || 0;

        findings.push({
          id: crypto.randomUUID(),
          type: 'non_descriptive_link',
          severity: 'serious',
          wcagCriteria: ['2.4.4'],
          title: `${count} links share generic text: "${link.text.trim()}"`,
          description:
            `${count} links on the page all have the text "${link.text.trim()}". When a braille user opens ` +
            `the links list (INSERT+F7), they see ${count} identical entries with no way to distinguish them.`,
          brailleExperience:
            `Links list shows ${count} identical "lnk ${link.text.trim()}" entries. The user cannot tell which link goes where.`,
          expectedExperience:
            'Each link should have unique descriptive text, e.g., "lnk Read more about pricing" vs "lnk Read more about features".',
          elementPath: link.automationId || `link[${normalized}]`,
          panCount: 0,
          navigationCost: makeCost({
            commandCount: count,
            frustrationIndex: 7,
            timeEstimate: count * 5,
          }),
          reproducibility:
            `Open links list (INSERT+F7). Search for "${link.text.trim()}". Multiple identical entries appear.`,
          axeCoreOverlap: true,
        });
      }
    }

    return findings;
  },
};
