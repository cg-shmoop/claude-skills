#!/usr/bin/env npx tsx
/**
 * SessionAssembler — Takes a JSONL navigation log from the braille subagent,
 * runs the CDP assessment engine, and produces the final session transcript.
 *
 * Usage:
 *   npx tsx Tools/SessionAssembler.ts <log-file.jsonl> <URL> [--task "description"]
 *
 * The JSONL file contains one JSON object per line, each with:
 *   { step, display, fullLine, mode, speech, command, reasoning, confused, confusionDesc }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SessionLogger } from './SessionLogger.js';
import { renderSession } from './SessionRenderer.js';
import { createDefaultEngine } from './AssessmentEngine.js';
import { commandToKeystroke, commandToDescription } from './types/index.js';
import type { NavigationCommand } from './types/index.js';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const logFile = process.argv[2];
const url = process.argv[3];
let task = 'explore the site';

for (let i = 4; i < process.argv.length; i++) {
  if (process.argv[i] === '--task' && process.argv[i + 1]) {
    task = process.argv[i + 1];
    i++;
  }
}

if (!logFile || !url) {
  console.error('Usage: npx tsx Tools/SessionAssembler.ts <log.jsonl> <URL> [--task "desc"]');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Parse log
// ---------------------------------------------------------------------------

interface LogEntry {
  step: number;
  display: string;
  fullLine: string;
  mode: 'browse' | 'forms';
  speech: string;
  command: any;       // AgentCommand
  commandDesc: string;
  keystroke: string;
  reasoning: string;
  success: boolean;
  confused: boolean;
  confusionDesc?: string;
  goalComplete?: boolean;
}

const rawLines = readFileSync(logFile, 'utf-8').trim().split('\n');
const entries: LogEntry[] = rawLines.filter(l => l.trim()).map(l => JSON.parse(l));

// ---------------------------------------------------------------------------
// Build session
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

let domain: string;
try { domain = new URL(url).hostname; } catch { domain = url; }

const taskSlug = slugify(task);
const logger = new SessionLogger({
  url,
  task,
  taskSlug,
  displaySize: 40,
  strategy: 'autonomous-llm',
  maxCommands: entries.length + 1,
});

// Log initial page load (first entry is typically the initial state)
for (const entry of entries) {
  const logData: any = {
    brailleDisplay: {
      cells: entry.display,
      fullLine: entry.fullLine,
      panPosition: 0,
      totalPans: entry.fullLine.length > 40 ? Math.ceil(entry.fullLine.length / 40) : 1,
      structuredPrefix: '',
    },
    intent: {
      goal: entry.reasoning.split('.')[0] || entry.reasoning,
      strategy: 'autonomous-llm',
      reasoning: entry.reasoning,
    },
    command: {
      type: entry.command?.type ?? 'unknown',
      detail: entry.commandDesc || JSON.stringify(entry.command),
      jawsEquivalent: entry.keystroke || '',
      modeRequired: entry.mode,
      modeCurrent: entry.mode,
    },
    result: {
      success: entry.success,
      outcome: entry.speech || `Braille: ${entry.display.trim()}`,
      newBrailleDisplay: entry.display,
      modeAfter: entry.mode,
      announcements: entry.speech ? [entry.speech] : [],
      liveRegionUpdates: [],
    },
  };

  if (entry.confused) {
    logData.confusion = {
      isConfused: true,
      description: entry.confusionDesc ?? 'Agent is confused',
      recoveryAction: entry.reasoning,
      wcagImplication: 'Potential accessibility barrier — blind user unable to determine next action',
      findingGenerated: false,
    };
  }

  logger.logEntry(logData);
}

// Run assessment (without CDP tree — we don't have one in this flow)
const assessmentEngine = createDefaultEngine();
const findings = assessmentEngine.evaluate({
  pageModel: {
    url, title: '', loadedAt: new Date(),
    headings: [], landmarks: [], links: [], formFields: [], tables: [],
    cursor: { elementId: '', elementType: '', elementName: '', lineIndex: 0, characterOffset: 0 },
    mode: 'browse',
    brailleDisplay: { displayedText: '', truncated: false, panPosition: 0, totalPans: 1, currentPan: 1, elementType: '', elementName: '', mode: 'browse' },
    visitedElements: [], discoveryPercentage: 0, findings: [],
  },
  navigationLog: [],
  sessionEntries: logger.getSession().entries,
});

for (const finding of findings) {
  logger.addFinding(finding);
}

// Complete session
const goalComplete = entries.some(e => e.goalComplete);
const notes = goalComplete
  ? `Autonomous agent completed goal — ${findings.length} finding(s)`
  : `Autonomous agent session ended — ${findings.length} finding(s)`;

logger.complete(goalComplete, notes);

// Save
const now = new Date();
const yearMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
const outputDir = join('C:', 'projects', 'accessibility-audits', 'braille-tests', yearMonth, domain, 'sessions');

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const sessionPath = logger.save(outputDir);
const session = logger.getSession();
const markdown = renderSession(session);
const mdPath = sessionPath.replace(/\.json$/, '.md');
writeFileSync(mdPath, markdown, 'utf-8');

console.log(JSON.stringify({
  sessionJson: sessionPath,
  transcriptMd: mdPath,
  commands: session.summary.totalCommands,
  findings: session.summary.findingsGenerated,
  goalComplete,
}));
