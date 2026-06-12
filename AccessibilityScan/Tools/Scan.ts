#!/usr/bin/env npx tsx
/**
 * Scan.ts - WCAG 2.2 AA Accessibility Scanner
 *
 * Core CLI tool that performs accessibility scanning using @axe-core/playwright.
 * Supports single-page and batch modes with HTML/JSON reporting.
 *
 * NOTE: This tool requires `npx tsx` (not bun) because bun's Playwright
 * browser launching hangs on Windows due to child process pipe issues.
 *
 * Usage:
 *   npx tsx Scan.ts <url>                          # Scan single page
 *   npx tsx Scan.ts --batch urls.txt               # Scan multiple pages
 *   npx tsx Scan.ts <url> --auth state.json        # Scan with auth
 *   npx tsx Scan.ts --batch urls.txt --parallel 10 # Batch with concurrency
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createHtmlReport } from 'axe-html-reporter';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliArgs {
  url: string | null;
  batch: string | null;
  auth: string | null;
  format: 'json' | 'html' | 'both';
  output: string;
  parallel: number;
  verbose: boolean;
  help: boolean;
}

interface PageResult {
  url: string;
  violations: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  axeResults: any;
  error: string | null;
}

interface BatchSummary {
  totalPages: number;
  totalViolations: number;
  scanDuration: number;
  byImpact: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  topViolations: Array<{
    ruleId: string;
    impact: string;
    count: number;
    description: string;
    helpUrl: string;
  }>;
  perPage: Array<{
    url: string;
    violations: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22a',
  'wcag22aa',
];

const NAV_TIMEOUT = 30_000;

const IMPACT_COLORS: Record<string, string> = {
  critical: '\x1b[31m',  // red
  serious: '\x1b[33m',   // yellow
  moderate: '\x1b[36m',  // cyan
  minor: '\x1b[37m',     // white
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    url: null,
    batch: null,
    auth: null,
    format: 'both',
    output: path.join(os.tmpdir(), 'accessibility-scan-results'),
    parallel: 5,
    verbose: false,
    help: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case '--help':
      case '-h':
        args.help = true;
        break;

      case '--batch':
      case '-b':
        i++;
        if (!argv[i]) {
          exitWithError('--batch requires a file path argument');
        }
        args.batch = argv[i];
        break;

      case '--auth':
      case '-a':
        i++;
        if (!argv[i]) {
          exitWithError('--auth requires a state file path argument');
        }
        args.auth = argv[i];
        break;

      case '--format':
      case '-f':
        i++;
        if (!argv[i] || !['json', 'html', 'both'].includes(argv[i])) {
          exitWithError('--format must be one of: json, html, both');
        }
        args.format = argv[i] as 'json' | 'html' | 'both';
        break;

      case '--output':
      case '-o':
        i++;
        if (!argv[i]) {
          exitWithError('--output requires a directory path argument');
        }
        args.output = path.resolve(argv[i]);
        break;

      case '--parallel':
      case '-p':
        i++;
        const num = parseInt(argv[i], 10);
        if (isNaN(num) || num < 1) {
          exitWithError('--parallel must be a positive integer');
        }
        args.parallel = num;
        break;

      case '--verbose':
      case '-v':
        args.verbose = true;
        break;

      default:
        if (arg.startsWith('-')) {
          exitWithError(`Unknown flag: ${arg}`);
        }
        // Positional argument = URL
        args.url = arg;
        break;
    }
    i++;
  }

  return args;
}

// ---------------------------------------------------------------------------
// Help Text
// ---------------------------------------------------------------------------

function printHelp(): void {
  const help = `
${BOLD}WCAG 2.2 AA Accessibility Scanner${RESET}

${BOLD}USAGE:${RESET}
  npx tsx Scan.ts <url> [options]           Scan a single page
  npx tsx Scan.ts --batch <file> [options]  Scan multiple pages from a file

${BOLD}ARGUMENTS:${RESET}
  <url>                     URL to scan (single page mode)

${BOLD}OPTIONS:${RESET}
  -b, --batch <file>        Path to a text file containing URLs (one per line)
                            Lines starting with # are comments, blank lines ignored
  -a, --auth <state-file>   Path to Playwright storageState JSON file for auth
  -f, --format <type>       Output format: json, html, or both (default: both)
  -o, --output <dir>        Output directory (default: <tmpdir>/accessibility-scan-results)
  -p, --parallel <n>        Concurrent pages in batch mode (default: 5)
  -v, --verbose             Enable detailed logging
  -h, --help                Show this help message

${BOLD}EXAMPLES:${RESET}
  ${DIM}# Scan a single page${RESET}
  npx tsx Scan.ts https://example.com

  ${DIM}# Scan with authentication${RESET}
  npx tsx Scan.ts https://app.example.com/dashboard --auth auth-state.json

  ${DIM}# Batch scan with custom output${RESET}
  npx tsx Scan.ts --batch urls.txt --output ./reports --parallel 10

  ${DIM}# JSON-only output for CI pipelines${RESET}
  npx tsx Scan.ts https://example.com --format json

${BOLD}WCAG TAGS CHECKED:${RESET}
  wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22a, wcag22aa

${BOLD}EXIT CODES:${RESET}
  0  Success (violations found is still success)
  1  User error (invalid arguments, missing files)
  2  System error (browser launch failure, etc.)
`;
  console.log(help);
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function exitWithError(message: string, code: number = 1): never {
  console.error(`${BOLD}\x1b[31mError:${RESET} ${message}`);
  process.exit(code);
}

function log(message: string, verbose: boolean = false, isVerbose: boolean = false): void {
  if (isVerbose && !verbose) return;
  console.log(message);
}

function sanitizeUrlForFilename(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[\/\\?&#=:*"<>|.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200); // Prevent excessively long filenames
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function countByImpact(violations: any[]): { critical: number; serious: number; moderate: number; minor: number } {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) {
    const impact = v.impact as keyof typeof counts;
    if (impact in counts) {
      counts[impact]++;
    }
  }
  return counts;
}

async function sendNotification(message: string): Promise<void> {
  try {
    await fetch('http://localhost:8888/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        title: 'Accessibility Scanner',
      }),
    });
  } catch {
    // Notification server may not be running - silently continue
  }
}

function readUrlsFromFile(filePath: string): string[] {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    exitWithError(`Batch file not found: ${resolvedPath}`);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

async function scanPage(
  page: Page,
  url: string,
  verbose: boolean,
): Promise<PageResult> {
  const result: PageResult = {
    url,
    violations: 0,
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    axeResults: null,
    error: null,
  };

  try {
    log(`  Navigating to: ${url}`, verbose, true);
    await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT });

    log(`  Running axe-core analysis...`, verbose, true);
    const axeResults = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    result.axeResults = axeResults;
    result.violations = axeResults.violations.length;

    const impacts = countByImpact(axeResults.violations);
    result.critical = impacts.critical;
    result.serious = impacts.serious;
    result.moderate = impacts.moderate;
    result.minor = impacts.minor;

    log(`  Found ${result.violations} violation(s)`, verbose, true);
  } catch (err: any) {
    result.error = err.message || String(err);
    log(`  Error scanning ${url}: ${result.error}`, true);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

function saveJsonReport(result: PageResult, outputDir: string): string {
  const filename = sanitizeUrlForFilename(result.url) + '.json';
  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(result.axeResults, null, 2), 'utf-8');
  return filePath;
}

function saveHtmlReport(result: PageResult, outputDir: string): string {
  const filename = sanitizeUrlForFilename(result.url) + '.html';
  const filePath = path.join(outputDir, filename);

  const htmlContent = createHtmlReport({
    results: result.axeResults,
    options: {
      projectKey: result.url,
      outputDirPath: outputDir,
      reportFileName: filename,
    },
  });

  // axe-html-reporter may write the file itself depending on version,
  // but we ensure it exists by writing if htmlContent is returned as string
  if (typeof htmlContent === 'string' && !fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, htmlContent, 'utf-8');
  }

  return filePath;
}

function printConsoleSummary(result: PageResult): void {
  console.log('');
  console.log(`${BOLD}Accessibility Scan Results: ${result.url}${RESET}`);
  console.log('='.repeat(70));

  if (result.error) {
    console.log(`${IMPACT_COLORS.critical}  ERROR: ${result.error}${RESET}`);
    return;
  }

  if (result.violations === 0) {
    console.log(`${GREEN}  No WCAG 2.2 AA violations found.${RESET}`);
    console.log('');
    return;
  }

  console.log(`  Total violations: ${BOLD}${result.violations}${RESET}`);
  console.log('');

  const levels: Array<[string, number]> = [
    ['critical', result.critical],
    ['serious', result.serious],
    ['moderate', result.moderate],
    ['minor', result.minor],
  ];

  for (const [level, count] of levels) {
    if (count > 0) {
      const color = IMPACT_COLORS[level] || RESET;
      const bar = '\u2588'.repeat(Math.min(count * 2, 40));
      console.log(`  ${color}${level.padEnd(10)}${RESET} ${color}${bar}${RESET} ${count}`);
    }
  }

  // Print individual violations detail
  if (result.axeResults?.violations) {
    console.log('');
    console.log(`${BOLD}  Violations Detail:${RESET}`);
    console.log('  ' + '-'.repeat(66));

    for (const v of result.axeResults.violations) {
      const color = IMPACT_COLORS[v.impact] || RESET;
      const nodeCount = v.nodes?.length || 0;
      console.log(`  ${color}[${v.impact}]${RESET} ${v.id} - ${v.description} (${nodeCount} node${nodeCount !== 1 ? 's' : ''})`);
      console.log(`  ${DIM}${v.helpUrl}${RESET}`);
    }
  }

  console.log('');
}

function printBatchSummary(summary: BatchSummary): void {
  console.log('');
  console.log(`${BOLD}${'='.repeat(70)}${RESET}`);
  console.log(`${BOLD}  BATCH SCAN SUMMARY${RESET}`);
  console.log(`${BOLD}${'='.repeat(70)}${RESET}`);
  console.log('');
  console.log(`  Pages scanned:    ${summary.totalPages}`);
  console.log(`  Total violations: ${summary.totalViolations}`);
  console.log(`  Scan duration:    ${(summary.scanDuration / 1000).toFixed(1)}s`);
  console.log('');

  console.log(`${BOLD}  Violations by Impact:${RESET}`);
  const impactEntries: Array<[string, number]> = [
    ['critical', summary.byImpact.critical],
    ['serious', summary.byImpact.serious],
    ['moderate', summary.byImpact.moderate],
    ['minor', summary.byImpact.minor],
  ];

  for (const [level, count] of impactEntries) {
    const color = IMPACT_COLORS[level] || RESET;
    console.log(`    ${color}${level.padEnd(10)}${RESET} ${count}`);
  }

  if (summary.topViolations.length > 0) {
    console.log('');
    console.log(`${BOLD}  Top Violations (by frequency):${RESET}`);
    const top = summary.topViolations.slice(0, 10);
    for (const v of top) {
      const color = IMPACT_COLORS[v.impact] || RESET;
      console.log(`    ${color}[${v.impact}]${RESET} ${v.ruleId} x${v.count} - ${v.description}`);
    }
  }

  console.log('');
}

function buildBatchSummary(results: PageResult[], durationMs: number): BatchSummary {
  const byImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const ruleMap = new Map<string, { ruleId: string; impact: string; count: number; description: string; helpUrl: string }>();

  const perPage: BatchSummary['perPage'] = [];
  let totalViolations = 0;

  for (const r of results) {
    perPage.push({
      url: r.url,
      violations: r.violations,
      critical: r.critical,
      serious: r.serious,
      moderate: r.moderate,
      minor: r.minor,
    });

    totalViolations += r.violations;
    byImpact.critical += r.critical;
    byImpact.serious += r.serious;
    byImpact.moderate += r.moderate;
    byImpact.minor += r.minor;

    if (r.axeResults?.violations) {
      for (const v of r.axeResults.violations) {
        const existing = ruleMap.get(v.id);
        if (existing) {
          existing.count++;
        } else {
          ruleMap.set(v.id, {
            ruleId: v.id,
            impact: v.impact || 'unknown',
            count: 1,
            description: v.description || '',
            helpUrl: v.helpUrl || '',
          });
        }
      }
    }
  }

  const topViolations = Array.from(ruleMap.values()).sort((a, b) => b.count - a.count);

  return {
    totalPages: results.length,
    totalViolations,
    scanDuration: durationMs,
    byImpact,
    topViolations,
    perPage,
  };
}

// ---------------------------------------------------------------------------
// Main: Single Page Mode
// ---------------------------------------------------------------------------

async function runSinglePage(args: CliArgs): Promise<void> {
  const url = args.url!;
  log(`${BOLD}Scanning:${RESET} ${url}`);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });

    const contextOptions: any = {};
    if (args.auth) {
      const authPath = path.resolve(args.auth);
      if (!fs.existsSync(authPath)) {
        exitWithError(`Auth state file not found: ${authPath}`);
      }
      contextOptions.storageState = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      log(`  Loaded auth state from: ${authPath}`, args.verbose, true);
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    const result = await scanPage(page, url, args.verbose);

    await page.close();
    await context.close();

    // Generate reports
    if (result.axeResults) {
      ensureDir(args.output);

      if (args.format === 'json' || args.format === 'both') {
        const jsonPath = saveJsonReport(result, args.output);
        log(`  JSON report: ${jsonPath}`);
      }

      if (args.format === 'html' || args.format === 'both') {
        const htmlPath = saveHtmlReport(result, args.output);
        log(`  HTML report: ${htmlPath}`);
      }
    }

    printConsoleSummary(result);
  } catch (err: any) {
    exitWithError(`System error during scan: ${err.message}`, 2);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Main: Batch Mode
// ---------------------------------------------------------------------------

async function runBatch(args: CliArgs): Promise<void> {
  const urls = readUrlsFromFile(args.batch!);

  if (urls.length === 0) {
    exitWithError('No URLs found in batch file');
  }

  log(`${BOLD}Batch scan: ${urls.length} URL(s), parallelism: ${args.parallel}${RESET}`);

  const pagesDir = path.join(args.output, 'pages');
  ensureDir(pagesDir);

  let browser: Browser | null = null;
  const allResults: PageResult[] = [];
  const startTime = Date.now();

  try {
    browser = await chromium.launch({ headless: true });

    const contextOptions: any = {};
    if (args.auth) {
      const authPath = path.resolve(args.auth);
      if (!fs.existsSync(authPath)) {
        exitWithError(`Auth state file not found: ${authPath}`);
      }
      contextOptions.storageState = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      log(`  Loaded auth state from: ${authPath}`);
    }

    const context = await browser.newContext(contextOptions);

    // Process URLs in batches
    let completed = 0;
    for (let batchStart = 0; batchStart < urls.length; batchStart += args.parallel) {
      const batchUrls = urls.slice(batchStart, batchStart + args.parallel);

      const batchPromises = batchUrls.map(async (url) => {
        const page = await context.newPage();
        try {
          const result = await scanPage(page, url, args.verbose);

          // Save per-page reports
          if (result.axeResults) {
            if (args.format === 'json' || args.format === 'both') {
              saveJsonReport(result, pagesDir);
            }
            if (args.format === 'html' || args.format === 'both') {
              saveHtmlReport(result, pagesDir);
            }
          }

          return result;
        } finally {
          await page.close();
        }
      });

      const settled = await Promise.allSettled(batchPromises);

      for (const outcome of settled) {
        completed++;
        if (outcome.status === 'fulfilled') {
          allResults.push(outcome.value);
          const r = outcome.value;
          const statusIcon = r.error ? '\x1b[31mx\x1b[0m' : r.violations > 0 ? '\x1b[33m!\x1b[0m' : `${GREEN}ok${RESET}`;
          log(`  [${completed}/${urls.length}] ${statusIcon} ${r.url} (${r.violations} violations)`);
        } else {
          completed; // Already incremented
          const errorMsg = outcome.reason?.message || String(outcome.reason);
          log(`  [${completed}/${urls.length}] \x1b[31mx\x1b[0m Unknown URL - Error: ${errorMsg}`);
          allResults.push({
            url: 'unknown',
            violations: 0,
            critical: 0,
            serious: 0,
            moderate: 0,
            minor: 0,
            axeResults: null,
            error: errorMsg,
          });
        }
      }
    }

    await context.close();

    const durationMs = Date.now() - startTime;
    const summary = buildBatchSummary(allResults, durationMs);

    // Save aggregate summary
    const summaryPath = path.join(args.output, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
    log(`  Summary saved: ${summaryPath}`);

    printBatchSummary(summary);
  } catch (err: any) {
    exitWithError(`System error during batch scan: ${err.message}`, 2);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Skip the first two args: bun executable and script path
  const rawArgs = process.argv.slice(2);
  const args = parseArgs(rawArgs);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Validate that we have either a URL or a batch file
  if (!args.url && !args.batch) {
    printHelp();
    exitWithError('Please provide a URL or use --batch <file>');
  }

  if (args.url && args.batch) {
    exitWithError('Cannot use both a URL argument and --batch at the same time');
  }

  // Notify on startup
  const mode = args.batch ? `Batch scan: ${args.batch}` : `Scanning: ${args.url}`;
  await sendNotification(`Accessibility scan started. ${mode}`);

  if (args.batch) {
    await runBatch(args);
  } else {
    await runSinglePage(args);
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err.message || err}`);
  process.exit(2);
});
