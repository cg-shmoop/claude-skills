/**
 * SessionRenderer — Converts a BrailleSession into human-readable Markdown.
 *
 * Produces a full audit transcript including every navigation step,
 * confusion points, findings, and summary statistics.
 */

import type {
  BrailleSession,
  SessionLogEntry,
  AccessibilityFinding,
} from './types/index.js';

/**
 * Render a complete BrailleSession as a Markdown transcript.
 */
export function renderSession(session: BrailleSession): string {
  const lines: string[] = [];

  // --- Header ---
  lines.push(`# Braille Session: ${session.task}`);
  lines.push('');
  lines.push(`**Date:** ${formatDate(session.startTime)}`);
  lines.push(`**URL:** ${session.url}`);
  lines.push(`**Display:** ${session.displaySize}-cell braille (Structured Mode)`);
  lines.push(`**Task:** ${session.task}`);
  lines.push(`**Credentials:** ${session.credentials ?? 'None'}`);

  const resultIcon = session.summary.taskCompleted ? '✅' : '❌';
  lines.push(
    `**Result:** ${resultIcon} ${session.summary.taskCompletionNotes} (${session.summary.totalCommands} commands, ~${session.summary.estimatedUserTimeSeconds}s estimated)`,
  );

  lines.push('');
  lines.push('---');
  lines.push('');

  // --- Transcript ---
  lines.push('## Transcript');
  lines.push('');

  for (const entry of session.entries) {
    lines.push(renderEntry(entry, session.displaySize));
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // --- Confusion Points ---
  lines.push('## Confusion Points');
  lines.push('');

  const confusionEntries = session.entries.filter((e) => e.confusion?.isConfused);
  if (confusionEntries.length === 0) {
    lines.push('None');
  } else {
    for (const entry of confusionEntries) {
      lines.push(
        `- **Step ${entry.sequence}:** ${entry.confusion!.description} — Recovery: ${entry.confusion!.recoveryAction}`,
      );
    }
  }

  lines.push('');

  // --- Findings ---
  lines.push('## Findings');
  lines.push('');

  if (session.findings.length === 0) {
    lines.push('No accessibility violations detected');
  } else {
    for (const finding of session.findings) {
      lines.push(renderFinding(finding));
    }
  }

  lines.push('');

  // --- Summary Table ---
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total commands | ${session.summary.totalCommands} |`);
  lines.push(`| Pan operations | ${session.summary.totalPanOperations} |`);
  lines.push(`| Mode changes | ${session.summary.totalModeChanges} |`);
  lines.push(`| Estimated user time | ~${session.summary.estimatedUserTimeSeconds} seconds |`);
  lines.push(`| Confusion points | ${session.summary.confusionPoints} |`);
  lines.push(`| Findings | ${session.summary.findingsGenerated} |`);

  return lines.join('\n');
}

/**
 * Render a single session log entry as Markdown.
 */
function renderEntry(entry: SessionLogEntry, displaySize: number): string {
  const lines: string[] = [];

  // Step header
  lines.push(`### Step ${entry.sequence} — ${entry.intent.goal}`);

  // Braille display (padded to displaySize)
  const paddedCells = entry.brailleDisplay.cells.padEnd(displaySize, ' ');
  lines.push(`**Display:** \`${paddedCells}\``);

  // Intent
  lines.push(`**Intent:** ${entry.intent.reasoning}`);

  // Command
  lines.push(
    `**Command:** ${entry.command.detail} [${entry.command.jawsEquivalent}] [${entry.command.modeCurrent} Mode]`,
  );

  // Result
  const resultIcon = entry.result.success ? '✅' : '⚠️';
  lines.push(`**Result:** ${resultIcon} ${entry.result.outcome}`);

  // Confusion point (if present)
  if (entry.confusion?.isConfused) {
    lines.push('');
    lines.push(`> **🔍 Confusion Point:** ${entry.confusion.description}`);
    lines.push('>');
    lines.push(`> **Recovery:** ${entry.confusion.recoveryAction}`);
    lines.push('>');
    lines.push(`> **WCAG Impact:** ${entry.confusion.wcagImplication}`);
    lines.push('>');
    lines.push(`> **Finding generated:** ${entry.confusion.findingGenerated ? 'Yes' : 'No'}`);
  }

  return lines.join('\n');
}

/**
 * Render a single accessibility finding as a Markdown list item.
 */
function renderFinding(finding: AccessibilityFinding): string {
  const severityIcons: Record<string, string> = {
    critical: '🔴',
    serious: '🟠',
    moderate: '🟡',
    minor: '⚪',
  };
  const icon = severityIcons[finding.severity] ?? '⚪';
  const criteria = finding.wcagCriteria.join(', ');

  return `- ${icon} **[${finding.severity.toUpperCase()}]** ${finding.title} (${criteria}) — ${finding.description}`;
}

/**
 * Format an ISO timestamp into a human-readable date string.
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}
