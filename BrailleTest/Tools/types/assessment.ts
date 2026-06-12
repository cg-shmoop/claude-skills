/**
 * Assessment types: findings, rules, reports.
 * Models how the agent evaluates accessibility from the braille perspective.
 */

import type { BrailleView } from './braille.js';
import type { ElementInfo } from './navigation.js';

// --- Findings ---

export interface AccessibilityFinding {
  id: string;
  type: FindingType;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  wcagCriteria: string[];
  title: string;
  description: string;
  brailleExperience: string;
  expectedExperience: string;
  elementPath: string;
  panCount: number;
  navigationCost: NavigationCost;
  reproducibility: string;
  axeCoreOverlap: boolean;
}

export type FindingType =
  | 'missing_heading_structure'
  | 'missing_landmark'
  | 'unlabeled_form_field'
  | 'non_descriptive_link'
  | 'missing_alt_text'
  | 'keyboard_trap'
  | 'focus_not_managed'
  | 'dynamic_content_silent'
  | 'excessive_navigation_cost'
  | 'truncation_problem'
  | 'mode_confusion'
  | 'missing_table_headers'
  | 'inaccessible_custom_widget'
  | 'timeout_too_short'
  | 'auto_advancing_content';

export interface NavigationCost {
  /** Total navigation commands issued to reach this element */
  commandCount: number;
  /** Total braille pan operations */
  panCount: number;
  /** Number of Browse/Forms mode switches */
  modeChanges: number;
  /** Estimated seconds for a real braille user */
  timeEstimate: number;
  /** 0-10 frustration heuristic based on cost vs task importance */
  frustrationIndex: number;
}

// --- Assessment Rules ---

export interface AssessmentRule {
  id: string;
  name: string;
  description: string;
  wcagCriteria: string[];
  evaluate(context: AssessmentContext): AccessibilityFinding[];
}

export interface AssessmentContext {
  pageModel: PageModel;
  navigationLog: NavigationEvent[];
  sessionEntries: SessionLogEntry[];
}

// --- Page Model (agent's mental model) ---

export interface PageModel {
  url: string;
  title: string;
  loadedAt: Date;

  headings: HeadingNode[];
  landmarks: LandmarkNode[];
  links: LinkNode[];
  formFields: FormFieldNode[];
  tables: TableNode[];

  cursor: CursorPosition;
  mode: 'browse' | 'forms';
  brailleDisplay: BrailleView;

  visitedElements: string[];
  discoveryPercentage: number;

  findings: AccessibilityFinding[];
}

export interface HeadingNode {
  level: number;
  text: string;
  automationId: string;
  characterCount: number;
  discovered: boolean;
}

export interface LandmarkNode {
  type: string;
  label: string;
  automationId: string;
  discovered: boolean;
}

export interface LinkNode {
  text: string;
  automationId: string;
  visited: boolean;
  discovered: boolean;
}

export interface FormFieldNode {
  type: string;
  label: string;
  automationId: string;
  required: boolean;
  hasError: boolean;
  discovered: boolean;
}

export interface TableNode {
  rowCount: number;
  colCount: number;
  hasHeaders: boolean;
  caption: string;
  automationId: string;
  discovered: boolean;
}

export interface CursorPosition {
  elementId: string;
  elementType: string;
  elementName: string;
  lineIndex: number;
  characterOffset: number;
}

// --- Navigation Events (logged during navigation) ---

export interface NavigationEvent {
  sequence: number;
  timestamp: string;
  commandType: string;
  commandDetail: string;
  elementBefore: ElementInfo | null;
  elementAfter: ElementInfo | null;
  modeBefore: 'browse' | 'forms';
  modeAfter: 'browse' | 'forms';
  brailleViewBefore: BrailleView;
  brailleViewAfter: BrailleView;
  success: boolean;
  error?: string;
}

// --- Session Log Entry (full audit trail) ---

export interface SessionLogEntry {
  sequence: number;
  timestamp: string;
  elapsedMs: number;
  estimatedUserTimeMs: number;

  brailleDisplay: {
    cells: string;
    fullLine: string;
    panPosition: number;
    totalPans: number;
    structuredPrefix: string;
  };

  intent: {
    goal: string;
    strategy: string;
    reasoning: string;
  };

  command: {
    type: string;
    detail: string;
    jawsEquivalent: string;
    modeRequired: 'browse' | 'forms';
    modeCurrent: 'browse' | 'forms';
  };

  result: {
    success: boolean;
    outcome: string;
    newBrailleDisplay: string;
    modeAfter: 'browse' | 'forms';
    announcements: string[];
    liveRegionUpdates: string[];
  };

  confusion?: {
    isConfused: boolean;
    description: string;
    recoveryAction: string;
    wcagImplication: string;
    findingGenerated: boolean;
  };
}

// --- Session Wrapper ---

export interface BrailleSession {
  sessionId: string;
  filename: string;
  startTime: string;
  endTime: string;
  timezone: string;
  domain: string;
  url: string;
  task: string;
  taskSlug: string;
  runNumber: number;
  previousRuns: string[];
  credentials?: string;
  displaySize: number;

  agent: {
    strategy: string;
    brailleMode: 'structured' | 'line' | 'speech_output';
    maxCommands: number;
  };

  entries: SessionLogEntry[];

  summary: {
    totalCommands: number;
    totalPanOperations: number;
    totalModeChanges: number;
    estimatedUserTimeSeconds: number;
    confusionPoints: number;
    findingsGenerated: number;
    taskCompleted: boolean;
    taskCompletionNotes: string;
  };

  findings: AccessibilityFinding[];
}

// --- Session Metadata (for file indexing) ---

export interface SessionMetadata {
  sessionId: string;
  filename: string;
  startTime: string;
  endTime: string;
  timezone: string;
  domain: string;
  task: string;
  taskSlug: string;
  runNumber: number;
  previousRuns: string[];
}

// --- Time estimation constants ---

/** Average time in ms for various braille user actions */
export const BRAILLE_TIME_ESTIMATES = {
  /** Time to pan one screen (press panning button, read new content) */
  panMs: 2000,
  /** Time to execute a navigation command and process result */
  commandMs: 1000,
  /** Time to read one word on braille display */
  readWordMs: 500,
  /** Time to type one character */
  typeCharMs: 300,
  /** Time to process a mode switch */
  modeSwitchMs: 1500,
  /** Time to process page load and initial announcement */
  pageLoadMs: 3000,
  /** Time to scan an element list dialog */
  elementListScanMs: 5000,
};
