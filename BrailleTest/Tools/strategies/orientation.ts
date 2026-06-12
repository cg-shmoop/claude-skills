/**
 * Orientation strategy — first thing the agent does on any new page.
 * Mirrors expert braille user behavior:
 *
 * 1. Read page title (what page am I on?)
 * 2. Jump to main content (skip nav, get to the meat)
 * 3. Scan headings within main to understand page structure
 * 4. Linear scan to read actual content
 * 5. Scan landmarks to understand page regions
 * 6. List links to see available destinations
 *
 * Key design: Jump to main FIRST, then explore outward. This ensures
 * the linear scan covers the actual page content (products, articles,
 * etc.) rather than the footer.
 */

import type { NavigationStrategy, NavigationStep } from '../types/index.js';

export const ORIENTATION_STRATEGY: NavigationStrategy = {
  name: 'orientation',
  description:
    'Initial page exploration matching expert braille user behavior. Used on first visit to any page.',
  steps: [
    // 1. Read the current line to know what page we're on
    {
      action: 'readPageTitle',
      command: { type: 'read', unit: 'line' } as const,
      description: 'Read current line — what page am I on?',
    },

    // 2. Jump to main content FIRST — skip nav, get to the core content
    //    Use heading level 1 (H1) as the primary anchor — most pages have
    //    an H1 in/near the main content area.
    {
      action: 'jumpToMainHeading',
      command: { type: 'quickNav', key: '1', direction: 'forward' } as const,
      description: 'Jump to first H1 heading — usually the main content title',
    },

    // 3. Scan headings from H1 to understand content structure
    {
      action: 'scanHeadings',
      command: { type: 'quickNav', key: 'h', direction: 'forward' } as const,
      description: 'Next heading — scan content structure',
      repeatUntil: 'noMoreElements',
    },

    // 4. Go back to the H1 to start reading from the top of main content
    {
      action: 'returnToMainHeading',
      command: { type: 'quickNav', key: '1', direction: 'forward' } as const,
      description: 'Return to H1 to start reading main content from the top',
    },

    // 5. Linear scan — read the actual content line by line
    //    This is where we discover what the page offers: products, links,
    //    articles, courses, etc.
    {
      action: 'linearScan',
      command: { type: 'move', direction: 'down' } as const,
      description: 'Read content line by line (Down Arrow)',
      repeatUntil: 'endOfMainContent',
    },

    // 6. Scan landmarks to understand page regions (nav, main, footer, etc.)
    {
      action: 'scanLandmarks',
      command: { type: 'quickNav', key: 'r', direction: 'forward' } as const,
      description: 'Next landmark/region — identify page structure',
      repeatUntil: 'noMoreElements',
    },

    // 7. List links — what destinations are available?
    {
      action: 'listLinks',
      command: { type: 'elementList', listType: 'links' } as const,
      description: 'List all links to see available destinations',
    },
  ],
};

/**
 * Returns a fresh copy of the orientation steps.
 */
export function createOrientationSteps(): NavigationStep[] {
  return ORIENTATION_STRATEGY.steps.map((step) => ({ ...step }));
}
