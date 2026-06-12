/**
 * SessionLogger — Records braille navigation session audit trails.
 *
 * Every braille display state, every command, every confusion point
 * is captured in a structured BrailleSession JSON file.
 */

import type {
  SessionLogEntry,
  BrailleSession,
  AccessibilityFinding,
  SessionMetadata,
} from './types/index.js';
import { BRAILLE_TIME_ESTIMATES } from './types/index.js';
import { existsSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class SessionLogger {
  private session: BrailleSession;
  private startTimestamp: number;
  private sequenceCounter: number;

  constructor(config: {
    url: string;
    task: string;
    taskSlug: string;
    displaySize?: number;
    strategy: string;
    maxCommands?: number;
  }) {
    const now = new Date();
    this.startTimestamp = now.getTime();
    this.sequenceCounter = 0;

    let domain: string;
    try {
      domain = new URL(config.url).hostname;
    } catch {
      domain = config.url;
    }

    this.session = {
      sessionId: randomUUID(),
      filename: '', // Set at save time
      startTime: now.toISOString(),
      endTime: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      domain,
      url: config.url,
      task: config.task,
      taskSlug: config.taskSlug,
      runNumber: 0, // Set at save time
      previousRuns: [], // Set at save time
      displaySize: config.displaySize ?? 40,

      agent: {
        strategy: config.strategy,
        brailleMode: 'structured',
        maxCommands: config.maxCommands ?? 100,
      },

      entries: [],

      summary: {
        totalCommands: 0,
        totalPanOperations: 0,
        totalModeChanges: 0,
        estimatedUserTimeSeconds: 0,
        confusionPoints: 0,
        findingsGenerated: 0,
        taskCompleted: false,
        taskCompletionNotes: '',
      },

      findings: [],
    };
  }

  /**
   * Add a log entry to the session. Auto-fills sequence, timestamp, and elapsedMs.
   */
  logEntry(entry: Partial<SessionLogEntry>): void {
    const now = new Date();
    this.sequenceCounter++;

    const fullEntry: SessionLogEntry = {
      sequence: this.sequenceCounter,
      timestamp: now.toISOString(),
      elapsedMs: now.getTime() - this.startTimestamp,
      estimatedUserTimeMs: this.estimateEntryTime(entry),

      brailleDisplay: entry.brailleDisplay ?? {
        cells: '',
        fullLine: '',
        panPosition: 0,
        totalPans: 1,
        structuredPrefix: '',
      },

      intent: entry.intent ?? {
        goal: '',
        strategy: '',
        reasoning: '',
      },

      command: entry.command ?? {
        type: '',
        detail: '',
        jawsEquivalent: '',
        modeRequired: 'browse',
        modeCurrent: 'browse',
      },

      result: entry.result ?? {
        success: true,
        outcome: '',
        newBrailleDisplay: '',
        modeAfter: 'browse',
        announcements: [],
        liveRegionUpdates: [],
      },

      confusion: entry.confusion,
    };

    this.session.entries.push(fullEntry);
  }

  /**
   * Add confusion data to the most recent log entry.
   */
  logConfusion(
    description: string,
    recoveryAction: string,
    wcagImplication: string,
    findingGenerated: boolean,
  ): void {
    const lastEntry = this.session.entries[this.session.entries.length - 1];
    if (!lastEntry) return;

    lastEntry.confusion = {
      isConfused: true,
      description,
      recoveryAction,
      wcagImplication,
      findingGenerated,
    };
  }

  /**
   * Add an accessibility finding to the session.
   */
  addFinding(finding: AccessibilityFinding): void {
    this.session.findings.push(finding);
  }

  /**
   * Finalize the session with summary statistics.
   */
  complete(taskCompleted: boolean, notes: string): void {
    const now = new Date();
    this.session.endTime = now.toISOString();

    let totalPanOperations = 0;
    let totalModeChanges = 0;
    let confusionPoints = 0;
    let totalEstimatedTimeMs = 0;

    let previousMode: 'browse' | 'forms' = 'browse';

    for (const entry of this.session.entries) {
      // Count pan operations
      if (entry.command.type === 'pan') {
        totalPanOperations++;
      }

      // Count mode changes
      if (entry.result.modeAfter !== previousMode) {
        totalModeChanges++;
        previousMode = entry.result.modeAfter;
      }

      // Count confusion points
      if (entry.confusion?.isConfused) {
        confusionPoints++;
      }

      // Accumulate estimated user time
      totalEstimatedTimeMs += entry.estimatedUserTimeMs;
    }

    this.session.summary = {
      totalCommands: this.session.entries.length,
      totalPanOperations: totalPanOperations,
      totalModeChanges: totalModeChanges,
      estimatedUserTimeSeconds: Math.round(totalEstimatedTimeMs / 1000),
      confusionPoints,
      findingsGenerated: this.session.findings.length,
      taskCompleted,
      taskCompletionNotes: notes,
    };
  }

  /**
   * Return the full BrailleSession object.
   */
  getSession(): BrailleSession {
    return this.session;
  }

  /**
   * Write the session JSON to disk with collision-safe naming.
   */
  save(outputDir: string): string {
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Discover previous runs with the same task slug
    const existingFiles = existsSync(outputDir) ? readdirSync(outputDir) : [];
    const slugPattern = new RegExp(`-${escapeRegex(this.session.taskSlug)}\\.json$`);
    const previousRuns = existingFiles.filter((f) => slugPattern.test(f));

    this.session.runNumber = previousRuns.length + 1;
    this.session.previousRuns = previousRuns;

    // Build collision-safe filename
    const now = new Date(this.session.startTime);
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const hh = now.getHours().toString().padStart(2, '0');
    const min = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');

    const baseName = `${yyyy}-${mm}-${dd}-${hh}${min}${ss}-${this.session.taskSlug}`;
    let filename = `${baseName}.json`;
    let filePath = join(outputDir, filename);

    if (existsSync(filePath)) {
      // Append 4-char hex disambiguator
      const hex = randomUUID().replace(/-/g, '').slice(0, 4);
      filename = `${baseName}-${hex}.json`;
      filePath = join(outputDir, filename);
    }

    this.session.filename = filename;

    writeFileSync(filePath, JSON.stringify(this.session, null, 2), 'utf-8');

    return filePath;
  }

  /**
   * Estimate the real-world braille user time for a single entry.
   */
  private estimateEntryTime(entry: Partial<SessionLogEntry>): number {
    const type = entry.command?.type ?? '';

    switch (type) {
      case 'pan':
        return BRAILLE_TIME_ESTIMATES.panMs;
      case 'enterFormsMode':
      case 'exitFormsMode':
        return BRAILLE_TIME_ESTIMATES.modeSwitchMs;
      case 'elementList':
        return BRAILLE_TIME_ESTIMATES.elementListScanMs;
      case 'typeText': {
        const text = entry.command?.detail ?? '';
        return text.length * BRAILLE_TIME_ESTIMATES.typeCharMs;
      }
      default:
        return BRAILLE_TIME_ESTIMATES.commandMs;
    }
  }
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
