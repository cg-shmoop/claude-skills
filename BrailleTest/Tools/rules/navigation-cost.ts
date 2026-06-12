/**
 * Navigation Cost Rule
 *
 * Evaluates how many commands a braille user needs to reach critical content.
 * Every extra command costs ~1-2 seconds of real time on a braille display.
 * Pages that bury main content behind dozens of navigation commands create
 * serious usability barriers.
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

/** Threshold: commands to reach main content before it's a problem */
const MAIN_CONTENT_COMMAND_THRESHOLD = 20;

/** Threshold: commands to reach a form on a form-focused page */
const FORM_REACH_COMMAND_THRESHOLD = 50;

/**
 * Estimate commands to reach main content by analyzing the navigation log.
 * Looks for the first navigation event that lands in a main landmark or
 * reaches the first meaningful content heading.
 */
function estimateCommandsToMainContent(
  context: AssessmentContext,
): number | null {
  const { navigationLog, pageModel } = context;

  // If there's a main landmark, count commands until we reach it
  const hasMain = pageModel.landmarks.some(
    (l) => l.type.toLowerCase() === 'main',
  );

  if (navigationLog.length === 0) {
    // No navigation log - estimate from page structure
    // If no main landmark and no skip link, count elements before first heading
    if (!hasMain && pageModel.headings.length > 0) {
      // Rough estimate: links + other elements before the first heading
      // Each link encountered is approximately 1 command
      return pageModel.links.filter((l) => !l.visited).length > 20 ? 25 : null;
    }
    return null;
  }

  // Scan navigation log for arrival at main content
  for (const event of navigationLog) {
    if (!event.elementAfter) continue;

    // Check if we reached a main landmark
    if (event.elementAfter.landmarkType?.toLowerCase() === 'main') {
      return event.sequence;
    }

    // Check if we reached an h1
    if (
      event.elementAfter.role?.toLowerCase() === 'heading' &&
      event.elementAfter.level === 1
    ) {
      return event.sequence;
    }
  }

  // Never reached main content - return total commands as lower bound
  return navigationLog.length;
}

/**
 * Estimate commands to reach the first form field.
 */
function estimateCommandsToForm(context: AssessmentContext): number | null {
  const { navigationLog } = context;

  if (navigationLog.length === 0) return null;

  for (const event of navigationLog) {
    if (!event.elementAfter) continue;

    const controlType = event.elementAfter.controlTypeName?.toLowerCase() || '';
    if (
      controlType === 'edit' ||
      controlType === 'combobox' ||
      controlType === 'checkbox' ||
      controlType === 'radiobutton' ||
      event.elementAfter.role?.toLowerCase() === 'textbox' ||
      event.elementAfter.role?.toLowerCase() === 'combobox'
    ) {
      return event.sequence;
    }
  }

  return null;
}

/**
 * Determine if this is a form-focused page based on the page model.
 */
function isFormFocusedPage(context: AssessmentContext): boolean {
  const { formFields, links, headings } = context.pageModel;

  // If form fields make up a significant portion of interactive elements
  if (formFields.length >= 2 && formFields.length >= links.length * 0.3) {
    return true;
  }

  // Check if page title or h1 suggests a form purpose
  const title = context.pageModel.title.toLowerCase();
  const formKeywords = [
    'login',
    'sign in',
    'sign up',
    'register',
    'checkout',
    'contact',
    'search',
    'subscribe',
    'apply',
    'order',
    'booking',
    'reservation',
    'payment',
    'settings',
    'profile',
    'account',
  ];

  if (formKeywords.some((kw) => title.includes(kw))) {
    return true;
  }

  // Check h1 headings
  for (const heading of headings) {
    if (
      heading.level === 1 &&
      formKeywords.some((kw) => heading.text.toLowerCase().includes(kw))
    ) {
      return true;
    }
  }

  return false;
}

export const navigationCostRule: AssessmentRule = {
  id: 'navigation-cost',
  name: 'Navigation Cost',
  description:
    'Checks the number of commands needed to reach critical content, identifying pages where braille users face excessive navigation overhead.',
  wcagCriteria: ['2.4.1', '2.4.5'],

  evaluate(context: AssessmentContext): AccessibilityFinding[] {
    const findings: AccessibilityFinding[] = [];
    const { pageModel } = context;

    // Check: too many commands to reach main content
    const commandsToMain = estimateCommandsToMainContent(context);
    if (
      commandsToMain !== null &&
      commandsToMain > MAIN_CONTENT_COMMAND_THRESHOLD
    ) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'excessive_navigation_cost',
        severity: 'serious',
        wcagCriteria: ['2.4.1', '2.4.5'],
        title: `${commandsToMain} commands to reach main content`,
        description:
          `It takes approximately ${commandsToMain} navigation commands to reach the main page content. ` +
          `At roughly 1-2 seconds per command on a braille display, this represents ` +
          `${commandsToMain}-${commandsToMain * 2} seconds of navigation before the user reaches any meaningful content.`,
        brailleExperience:
          `User must press Down Arrow or other navigation keys ${commandsToMain} times, ` +
          `reading through headers, navigation links, and other preamble on the braille display before reaching content.`,
        expectedExperience:
          'A skip-to-main link or main landmark should allow the user to reach content within 1-3 commands.',
        elementPath: 'document',
        panCount: Math.ceil(commandsToMain * 0.5),
        navigationCost: makeCost({
          commandCount: commandsToMain,
          panCount: Math.ceil(commandsToMain * 0.5),
          frustrationIndex: Math.min(10, Math.ceil(commandsToMain / 5)),
          timeEstimate: commandsToMain * 1.5,
        }),
        reproducibility:
          `Navigate from the top of the page using Down Arrow. Count commands until main content is reached: ${commandsToMain}.`,
        axeCoreOverlap: false,
      });
    }

    // Check: no skip-to-main link AND no main landmark
    const hasMain = pageModel.landmarks.some(
      (l) => l.type.toLowerCase() === 'main',
    );

    // Detect skip link: look for a link near the start with skip-related text
    const hasSkipLink = pageModel.links.some((link) => {
      const text = link.text.toLowerCase();
      return (
        text.includes('skip to') ||
        text.includes('skip navigation') ||
        text.includes('jump to content') ||
        text.includes('go to main') ||
        text.includes('skip to main')
      );
    });

    if (!hasMain && !hasSkipLink) {
      findings.push({
        id: crypto.randomUUID(),
        type: 'excessive_navigation_cost',
        severity: 'serious',
        wcagCriteria: ['2.4.1', '2.4.5'],
        title: 'No skip link and no main landmark',
        description:
          'The page has neither a skip-to-main-content link nor a main landmark. ' +
          'Braille users have no mechanism to bypass repeated navigation blocks and must read through ' +
          'all header content on every page visit.',
        brailleExperience:
          'Pressing Q (jump to main) does nothing. No skip link is found at the top of the page. ' +
          'User must navigate through all page preamble every time.',
        expectedExperience:
          'Either a "Skip to main content" link as the first focusable element, or a main landmark ' +
          'reachable via Q, should be present.',
        elementPath: 'document',
        panCount: 0,
        navigationCost: makeCost({
          commandCount: 15,
          frustrationIndex: 7,
          timeEstimate: 20,
        }),
        reproducibility:
          'Tab from the top of the page - no skip link appears. Press Q - no main landmark is reached.',
        axeCoreOverlap: true,
      });
    }

    // Check: form-focused page with excessive commands to reach the form
    if (isFormFocusedPage(context)) {
      const commandsToForm = estimateCommandsToForm(context);
      if (
        commandsToForm !== null &&
        commandsToForm > FORM_REACH_COMMAND_THRESHOLD
      ) {
        findings.push({
          id: crypto.randomUUID(),
          type: 'excessive_navigation_cost',
          severity: 'critical',
          wcagCriteria: ['2.4.1', '2.4.5'],
          title: `${commandsToForm} commands to reach form on form-focused page`,
          description:
            `This page appears to be form-focused (${pageModel.title}), but the first form field ` +
            `requires ${commandsToForm} navigation commands to reach. The primary task is buried under ` +
            `excessive preamble content.`,
          brailleExperience:
            `User navigates ${commandsToForm} times before reaching the first form field. ` +
            `At 1-2 seconds per command, the primary task takes ${commandsToForm}-${commandsToForm * 2} seconds to even begin.`,
          expectedExperience:
            'On form-focused pages, the form should be reachable within a few commands via heading navigation, ' +
            'skip link, or main landmark.',
          elementPath: 'document',
          panCount: Math.ceil(commandsToForm * 0.4),
          navigationCost: makeCost({
            commandCount: commandsToForm,
            panCount: Math.ceil(commandsToForm * 0.4),
            frustrationIndex: 10,
            timeEstimate: commandsToForm * 1.5,
          }),
          reproducibility:
            `Navigate from page top to the first form field. Count commands: ${commandsToForm}. ` +
            `This exceeds the ${FORM_REACH_COMMAND_THRESHOLD}-command threshold for form-focused pages.`,
          axeCoreOverlap: false,
        });
      }
    }

    return findings;
  },
};
