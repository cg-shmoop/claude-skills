#!/usr/bin/env bun
/**
 * DevDiaryCapture.ts - Development diary event capture CLI
 *
 * Captures development events (milestones, failures, progress, decisions)
 * with optional screenshot references and file change tracking.
 *
 * Usage:
 *   bun DevDiaryCapture.ts capture <project> <description> [options]
 *   bun DevDiaryCapture.ts list <project> [--date YYYY-MM-DD]
 *   bun DevDiaryCapture.ts status [project]
 *   bun DevDiaryCapture.ts init <project>
 *
 * Options:
 *   --type <milestone|failure|progress|decision>  Event type (default: progress)
 *   --screenshot <path>                           Path to screenshot file
 *   --tag <tag>                                   Add tag (repeatable)
 *   --context <text>                              Additional context
 *   --date <YYYY-MM-DD>                           Override date (default: today)
 *
 * @author PAI System
 * @version 1.0.0
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync, appendFileSync } from 'fs';
import { join, basename, extname } from 'path';
import { homedir } from 'os';

// ============================================
// CONFIGURATION
// ============================================

const HOME = process.env.HOME || process.env.USERPROFILE || homedir();
const CONTENT_DIR = join(HOME, '.claude', 'MEMORY', 'CONTENT');

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// ============================================
// TYPES
// ============================================

interface DiaryEvent {
  timestamp: string;
  type: 'milestone' | 'failure' | 'progress' | 'decision';
  description: string;
  screenshot: string | null;
  files_changed: string[];
  errors: string[];
  context: string;
  tags: string[];
}

// ============================================
// HELPERS
// ============================================

function getDateStr(dateOverride?: string): string {
  if (dateOverride) return dateOverride;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getProjectDir(project: string, date: string): string {
  return join(CONTENT_DIR, project, date);
}

function getEventsPath(project: string, date: string): string {
  return join(getProjectDir(project, date), 'events.jsonl');
}

function getScreenshotsDir(project: string, date: string): string {
  return join(getProjectDir(project, date), 'screenshots');
}

function ensureProjectDir(project: string, date: string): void {
  const dir = getProjectDir(project, date);
  mkdirSync(join(dir, 'screenshots'), { recursive: true });
  mkdirSync(join(dir, 'posts'), { recursive: true });
}

function loadEvents(project: string, date: string): DiaryEvent[] {
  const path = getEventsPath(project, date);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function getNextScreenshotNumber(project: string, date: string): number {
  const dir = getScreenshotsDir(project, date);
  if (!existsSync(dir)) return 1;
  const files = readdirSync(dir).filter(f => /^\d{3}_/.test(f));
  return files.length + 1;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
    .replace(/-$/, '');
}

// ============================================
// COMMANDS
// ============================================

function capture(
  project: string,
  description: string,
  options: {
    type?: DiaryEvent['type'];
    screenshot?: string;
    tags?: string[];
    context?: string;
    date?: string;
  } = {}
): void {
  const date = getDateStr(options.date);
  ensureProjectDir(project, date);

  // Copy screenshot if provided
  let screenshotRef: string | null = null;
  if (options.screenshot && existsSync(options.screenshot)) {
    const num = getNextScreenshotNumber(project, date);
    const slug = slugify(description);
    const ext = extname(options.screenshot) || '.png';
    const filename = `${String(num).padStart(3, '0')}_${slug}${ext}`;
    const dest = join(getScreenshotsDir(project, date), filename);
    copyFileSync(options.screenshot, dest);
    screenshotRef = `screenshots/${filename}`;
    console.log(`${c.green}  Screenshot copied:${c.reset} ${filename}`);
  }

  // Build event
  const event: DiaryEvent = {
    timestamp: new Date().toISOString(),
    type: options.type || 'progress',
    description,
    screenshot: screenshotRef,
    files_changed: [],
    errors: [],
    context: options.context || '',
    tags: options.tags || [],
  };

  // Append to events file
  const eventsPath = getEventsPath(project, date);
  appendFileSync(eventsPath, JSON.stringify(event) + '\n');

  // Count events
  const events = loadEvents(project, date);
  const typeIcon = {
    milestone: `${c.green}★${c.reset}`,
    failure: `${c.red}✗${c.reset}`,
    progress: `${c.blue}→${c.reset}`,
    decision: `${c.yellow}◆${c.reset}`,
  }[event.type];

  console.log(`\n${c.bold}DevDiary captured:${c.reset} ${description}`);
  console.log(`  ${typeIcon} Type: ${event.type}`);
  if (screenshotRef) {
    console.log(`  ${c.cyan}📸 Screenshot:${c.reset} ${screenshotRef}`);
  }
  console.log(`  ${c.dim}Event #${events.length} for ${project} on ${date}${c.reset}`);
}

function listEvents(project: string, date?: string): void {
  const targetDate = date || getDateStr();
  const events = loadEvents(project, targetDate);

  if (events.length === 0) {
    console.log(`\n${c.dim}No events for ${project} on ${targetDate}${c.reset}`);
    console.log(`${c.dim}Start capturing: bun DevDiaryCapture.ts capture ${project} "description"${c.reset}`);
    return;
  }

  console.log(`\n${c.bold}DevDiary: ${project}${c.reset} (${targetDate})`);
  console.log(`${'─'.repeat(50)}`);

  events.forEach((event, i) => {
    const time = new Date(event.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const icon = {
      milestone: `${c.green}★${c.reset}`,
      failure: `${c.red}✗${c.reset}`,
      progress: `${c.blue}→${c.reset}`,
      decision: `${c.yellow}◆${c.reset}`,
    }[event.type];

    console.log(`  ${i + 1}. ${icon} ${c.dim}${time}${c.reset} ${event.description}`);
    if (event.screenshot) {
      console.log(`     ${c.cyan}📸 ${event.screenshot}${c.reset}`);
    }
    if (event.tags.length > 0) {
      console.log(`     ${c.magenta}${event.tags.map(t => `#${t}`).join(' ')}${c.reset}`);
    }
  });

  console.log(`${'─'.repeat(50)}`);
  const byType = {
    milestone: events.filter(e => e.type === 'milestone').length,
    failure: events.filter(e => e.type === 'failure').length,
    progress: events.filter(e => e.type === 'progress').length,
    decision: events.filter(e => e.type === 'decision').length,
  };
  const parts = Object.entries(byType).filter(([, v]) => v > 0).map(([k, v]) => `${k}: ${v}`);
  console.log(`  ${c.dim}${events.length} events (${parts.join(', ')})${c.reset}`);
  const screenshots = events.filter(e => e.screenshot).length;
  console.log(`  ${c.dim}${screenshots} screenshots${c.reset}`);
}

function status(project?: string): void {
  if (!existsSync(CONTENT_DIR)) {
    console.log(`\n${c.dim}No content directory yet. Initialize a project first.${c.reset}`);
    return;
  }

  const projects = project ? [project] : readdirSync(CONTENT_DIR).filter(f => {
    const path = join(CONTENT_DIR, f);
    try { return Bun.file(path).size === undefined; } catch { return true; }
  });

  if (projects.length === 0) {
    console.log(`\n${c.dim}No projects found.${c.reset}`);
    return;
  }

  console.log(`\n${c.bold}DevDiary Status${c.reset}`);
  console.log(`${'═'.repeat(50)}`);

  for (const proj of projects) {
    const projDir = join(CONTENT_DIR, proj);
    if (!existsSync(projDir)) {
      console.log(`\n${c.red}Project not found: ${proj}${c.reset}`);
      continue;
    }

    const dates = readdirSync(projDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    if (dates.length === 0) {
      console.log(`\n${c.yellow}${proj}${c.reset}: no entries yet`);
      continue;
    }

    let totalEvents = 0;
    let totalScreenshots = 0;

    console.log(`\n${c.bold}${proj}${c.reset}`);
    for (const date of dates) {
      const events = loadEvents(proj, date);
      const screenshots = events.filter(e => e.screenshot).length;
      totalEvents += events.length;
      totalScreenshots += screenshots;

      const postsDir = join(projDir, date, 'posts');
      const hasDraft = existsSync(postsDir) && readdirSync(postsDir).some(f => f.startsWith('draft-'));
      const draftLabel = hasDraft ? ` ${c.green}[draft ready]${c.reset}` : '';

      console.log(`  ${date}: ${events.length} events, ${screenshots} screenshots${draftLabel}`);
    }
    console.log(`  ${c.dim}Total: ${totalEvents} events, ${totalScreenshots} screenshots across ${dates.length} days${c.reset}`);
  }
}

function init(project: string): void {
  const date = getDateStr();
  ensureProjectDir(project, date);
  console.log(`\n${c.green}${c.bold}DevDiary initialized:${c.reset} ${project}`);
  console.log(`  ${c.dim}Content dir: ${getProjectDir(project, date)}${c.reset}`);
  console.log(`\n  ${c.bold}Next steps:${c.reset}`);
  console.log(`  1. Capture moments:  bun DevDiaryCapture.ts capture ${project} "description" --type milestone`);
  console.log(`  2. Add screenshots:  bun DevDiaryCapture.ts capture ${project} "description" --screenshot /path/to/image.png`);
  console.log(`  3. Review captures:  bun DevDiaryCapture.ts list ${project}`);
  console.log(`  4. Synthesize blog:  Use the DevDiary skill's Synthesize workflow`);
}

// ============================================
// CLI PARSER
// ============================================

const args = process.argv.slice(2);
const command = args[0];

function parseFlags(args: string[]): Record<string, string | string[]> {
  const flags: Record<string, string | string[]> = {};
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] || '';
      if (key === 'tag') {
        if (!Array.isArray(flags.tags)) flags.tags = [];
        (flags.tags as string[]).push(value);
      } else {
        flags[key] = value;
      }
      i += 2;
    } else {
      i++;
    }
  }
  return flags;
}

switch (command) {
  case 'capture': {
    const project = args[1];
    const description = args[2];
    if (!project || !description) {
      console.error(`${c.red}Usage: DevDiaryCapture.ts capture <project> "<description>" [options]${c.reset}`);
      console.error(`  --type <milestone|failure|progress|decision>`);
      console.error(`  --screenshot <path>`);
      console.error(`  --tag <tag> (repeatable)`);
      console.error(`  --context "<text>"`);
      console.error(`  --date <YYYY-MM-DD>`);
      process.exit(1);
    }
    const flags = parseFlags(args.slice(3));
    capture(project, description, {
      type: (flags.type as DiaryEvent['type']) || undefined,
      screenshot: flags.screenshot as string,
      tags: (flags.tags as string[]) || [],
      context: flags.context as string,
      date: flags.date as string,
    });
    break;
  }

  case 'list': {
    const project = args[1];
    if (!project) {
      console.error(`${c.red}Usage: DevDiaryCapture.ts list <project> [--date YYYY-MM-DD]${c.reset}`);
      process.exit(1);
    }
    const flags = parseFlags(args.slice(2));
    listEvents(project, flags.date as string);
    break;
  }

  case 'status':
    status(args[1]);
    break;

  case 'init': {
    const project = args[1];
    if (!project) {
      console.error(`${c.red}Usage: DevDiaryCapture.ts init <project>${c.reset}`);
      process.exit(1);
    }
    init(project);
    break;
  }

  case '--help':
  case 'help':
  default:
    console.log(`
${c.bold}DevDiary Capture CLI${c.reset} - Development diary event tracking

${c.bold}Commands:${c.reset}
  capture <project> <description>  Capture a development event
  list <project> [--date D]        List events for a project
  status [project]                 Show diary status overview
  init <project>                   Initialize a new project diary

${c.bold}Capture Options:${c.reset}
  --type <type>          Event type: milestone, failure, progress, decision
  --screenshot <path>    Screenshot file to include
  --tag <tag>            Tag (repeatable: --tag shader --tag debug)
  --context "<text>"     Additional context
  --date <YYYY-MM-DD>    Date override (default: today)

${c.bold}Examples:${c.reset}
  ${c.dim}# Capture a milestone with screenshot${c.reset}
  bun DevDiaryCapture.ts capture godot-game "Vector field working" --type milestone --screenshot ./screen.png

  ${c.dim}# Log a failure${c.reset}
  bun DevDiaryCapture.ts capture godot-game "Physics collision broken" --type failure --tag physics --tag bug

  ${c.dim}# Check status${c.reset}
  bun DevDiaryCapture.ts status
`);
}
