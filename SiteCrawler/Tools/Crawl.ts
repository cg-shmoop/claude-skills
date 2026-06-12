#!/usr/bin/env npx tsx
/**
 * Crawl.ts — Browser-based site crawler for URL discovery
 *
 * Uses Playwright to visit pages, extract internal links via BFS,
 * and output a deduplicated URL list suitable for AccessibilityScan --batch.
 *
 * Runtime: npx tsx (NOT bun — Playwright hangs on Windows with bun)
 *
 * Usage:
 *   npx tsx Tools/Crawl.ts https://app.example.com [options]
 *   npx tsx Tools/Crawl.ts https://app.example.com --auth auth-state.json -o urls.txt
 */

import { chromium, type Page, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CliArgs {
  startUrl: string | null;
  auth: string | null;
  output: string | null;  // null = stdout
  depth: number;
  maxPages: number;
  sitemap: boolean;
  exclude: string[];
  includeQuery: boolean;
  parallel: number;
  verbose: boolean;
  help: boolean;
}

interface CrawlResult {
  urls: string[];
  visited: number;
  skipped: number;
  errors: number;
  duration: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAV_TIMEOUT = 20_000;
const DEFAULT_DEPTH = 5;
const DEFAULT_MAX_PAGES = 500;
const DEFAULT_PARALLEL = 3;

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.wmv', '.flv',
  '.css', '.js', '.json', '.xml', '.txt', '.csv',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
]);

const SKIP_SCHEMES = new Set(['mailto:', 'tel:', 'javascript:', 'data:', 'blob:', 'ftp:']);

// ─── ANSI Colors ─────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
};

// ─── Argument Parsing ────────────────────────────────────────────────────────

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    startUrl: null,
    auth: null,
    output: null,
    depth: DEFAULT_DEPTH,
    maxPages: DEFAULT_MAX_PAGES,
    sitemap: false,
    exclude: [],
    includeQuery: false,
    parallel: DEFAULT_PARALLEL,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--help': case '-h':
        args.help = true;
        break;
      case '--auth': case '-a':
        args.auth = argv[++i];
        break;
      case '--output': case '-o':
        args.output = argv[++i];
        break;
      case '--depth': case '-d':
        args.depth = parseInt(argv[++i], 10);
        break;
      case '--max-pages': case '-m':
        args.maxPages = parseInt(argv[++i], 10);
        break;
      case '--sitemap': case '-s':
        args.sitemap = true;
        break;
      case '--exclude': case '-e':
        args.exclude.push(argv[++i]);
        break;
      case '--include-query':
        args.includeQuery = true;
        break;
      case '--parallel': case '-p':
        args.parallel = parseInt(argv[++i], 10);
        break;
      case '--verbose': case '-v':
        args.verbose = true;
        break;
      default:
        if (!arg.startsWith('-') && !args.startUrl) {
          args.startUrl = arg;
        }
        break;
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
${C.bold}SiteCrawler — Browser-based URL discovery${C.reset}

${C.cyan}USAGE:${C.reset}
  npx tsx Tools/Crawl.ts <start-url> [options]

${C.cyan}OPTIONS:${C.reset}
  <start-url>          Starting URL to crawl from (required)
  --auth, -a <path>    Playwright storage state JSON for authenticated crawling
  --output, -o <path>  Output file path (default: stdout)
  --depth, -d <n>      Max crawl depth from start URL (default: ${DEFAULT_DEPTH})
  --max-pages, -m <n>  Max pages to visit (default: ${DEFAULT_MAX_PAGES})
  --sitemap, -s        Also parse sitemap.xml for additional URL discovery
  --exclude, -e <pat>  URL substring pattern to exclude (repeatable)
  --include-query      Keep query parameters in URLs (default: strip them)
  --parallel, -p <n>   Concurrent page visits (default: ${DEFAULT_PARALLEL})
  --verbose, -v        Show detailed crawl progress
  --help, -h           Show this help message

${C.cyan}EXAMPLES:${C.reset}
  ${C.dim}# Basic crawl${C.reset}
  npx tsx Tools/Crawl.ts https://app.example.com -o urls.txt

  ${C.dim}# Authenticated crawl with sitemap seeding${C.reset}
  npx tsx Tools/Crawl.ts https://app.example.com \\
    --auth ../AccessibilityScan/auth-state.json \\
    --sitemap -o urls.txt

  ${C.dim}# Exclude patterns${C.reset}
  npx tsx Tools/Crawl.ts https://example.com \\
    -e "/api/" -e "/admin/" -e "/logout" -o urls.txt

${C.cyan}OUTPUT:${C.reset}
  One fully-qualified URL per line, suitable for:
    npx tsx ../AccessibilityScan/Tools/Scan.ts --batch urls.txt
`);
}

// ─── URL Utilities ───────────────────────────────────────────────────────────

function normalizeUrl(raw: string, baseUrl: string, includeQuery: boolean): string | null {
  try {
    const parsed = new URL(raw, baseUrl);

    // Skip non-http schemes
    for (const scheme of SKIP_SCHEMES) {
      if (raw.toLowerCase().startsWith(scheme)) return null;
    }

    // Skip file extensions that aren't pages
    const pathname = parsed.pathname.toLowerCase();
    const ext = path.extname(pathname);
    if (ext && SKIP_EXTENSIONS.has(ext)) return null;

    // Strip fragment
    parsed.hash = '';

    // Optionally strip query params
    if (!includeQuery) {
      parsed.search = '';
    }

    // Normalize trailing slash for root paths
    if (parsed.pathname === '') {
      parsed.pathname = '/';
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function isSameDomain(url: string, baseDomain: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === baseDomain || parsed.hostname.endsWith('.' + baseDomain);
  } catch {
    return false;
  }
}

function matchesExcludePattern(url: string, patterns: string[]): boolean {
  return patterns.some(pattern => url.includes(pattern));
}

// ─── Sitemap Parser ──────────────────────────────────────────────────────────

async function parseSitemap(baseUrl: string, verbose: boolean): Promise<string[]> {
  const urls: string[] = [];
  const sitemapUrls: string[] = [];

  // Try common sitemap locations
  const candidates = [
    new URL('/sitemap.xml', baseUrl).href,
    new URL('/sitemap_index.xml', baseUrl).href,
    new URL('/sitemap/', baseUrl).href,
  ];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: { 'User-Agent': 'SiteCrawler/1.0 (accessibility-audit)' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) continue;

      const text = await response.text();
      if (!text.includes('<urlset') && !text.includes('<sitemapindex')) continue;

      log(`  Found sitemap: ${candidate}`, verbose);

      // Extract <loc> tags (works for both urlset and sitemapindex)
      const locMatches = text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);
      for (const match of locMatches) {
        const loc = match[1].trim();
        if (loc.includes('sitemap') && loc.endsWith('.xml')) {
          sitemapUrls.push(loc);
        } else {
          urls.push(loc);
        }
      }

      break; // Found a valid sitemap, stop trying candidates
    } catch {
      // Try next candidate
    }
  }

  // Recursively fetch sub-sitemaps (one level deep)
  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'SiteCrawler/1.0 (accessibility-audit)' },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) continue;
      const text = await response.text();

      const locMatches = text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi);
      for (const match of locMatches) {
        const loc = match[1].trim();
        if (!loc.includes('sitemap') || !loc.endsWith('.xml')) {
          urls.push(loc);
        }
      }

      log(`  Sub-sitemap ${sitemapUrl}: ${urls.length} URLs so far`, verbose);
    } catch {
      // Skip failed sub-sitemaps
    }
  }

  return urls;
}

// ─── Link Extraction ─────────────────────────────────────────────────────────

async function extractLinks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const anchors = document.querySelectorAll('a[href]');
    return Array.from(anchors).map(a => (a as HTMLAnchorElement).href);
  });
}

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg: string, verbose: boolean, force = false): void {
  if (verbose || force) {
    console.error(msg);
  }
}

// ─── Main Crawl Loop (BFS) ──────────────────────────────────────────────────

async function crawl(args: CliArgs): Promise<CrawlResult> {
  const startTime = Date.now();
  const startUrl = args.startUrl!;
  const baseDomain = new URL(startUrl).hostname;

  const discovered = new Set<string>();
  const visited = new Set<string>();
  let errorCount = 0;
  let skippedCount = 0;

  // BFS queue: [url, depth]
  const queue: Array<[string, number]> = [];

  // Seed with start URL
  const normalizedStart = normalizeUrl(startUrl, startUrl, args.includeQuery);
  if (normalizedStart) {
    discovered.add(normalizedStart);
    queue.push([normalizedStart, 0]);
  }

  // Optionally seed from sitemap
  if (args.sitemap) {
    log(`${C.cyan}Parsing sitemap...${C.reset}`, true, true);
    const sitemapUrls = await parseSitemap(startUrl, args.verbose);
    log(`  Sitemap yielded ${sitemapUrls.length} URLs`, true, true);

    for (const url of sitemapUrls) {
      const normalized = normalizeUrl(url, startUrl, args.includeQuery);
      if (normalized && !discovered.has(normalized) && isSameDomain(normalized, baseDomain)) {
        if (!matchesExcludePattern(normalized, args.exclude)) {
          discovered.add(normalized);
          queue.push([normalized, 0]); // Sitemap URLs start at depth 0
        }
      }
    }
  }

  log(`${C.cyan}Starting crawl from: ${startUrl}${C.reset}`, true, true);
  log(`  Domain: ${baseDomain}`, true, true);
  log(`  Max depth: ${args.depth}, Max pages: ${args.maxPages}`, true, true);
  log(`  Parallel: ${args.parallel}`, true, true);
  if (args.exclude.length > 0) {
    log(`  Exclude patterns: ${args.exclude.join(', ')}`, true, true);
  }
  log('', true, true);

  // Launch browser
  const browser = await chromium.launch({ headless: true });

  const contextOptions: Record<string, unknown> = {};
  if (args.auth) {
    const authPath = path.resolve(args.auth);
    if (!fs.existsSync(authPath)) {
      console.error(`${C.red}Error: Auth state file not found: ${authPath}${C.reset}`);
      process.exit(1);
    }
    contextOptions.storageState = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    log(`  Loaded auth state from: ${authPath}`, true, true);
  }

  const context: BrowserContext = await browser.newContext(contextOptions);

  // BFS crawl
  let queueIndex = 0;

  while (queueIndex < queue.length && visited.size < args.maxPages) {
    // Take a batch of URLs from the queue
    const batchSize = Math.min(args.parallel, args.maxPages - visited.size, queue.length - queueIndex);
    const batch: Array<[string, number]> = [];

    for (let i = 0; i < batchSize && queueIndex < queue.length; i++) {
      const item = queue[queueIndex];
      queueIndex++;

      if (visited.has(item[0])) {
        i--; // Don't count already-visited URLs
        continue;
      }

      if (item[1] > args.depth) {
        skippedCount++;
        i--;
        continue;
      }

      batch.push(item);
    }

    if (batch.length === 0) {
      // Check if there are more in the queue
      if (queueIndex >= queue.length) break;
      continue;
    }

    // Process batch concurrently
    const promises = batch.map(async ([url, depth]) => {
      if (visited.has(url)) return;
      visited.add(url);

      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

        // Get the final URL after redirects
        const finalUrl = normalizeUrl(page.url(), startUrl, args.includeQuery);
        if (finalUrl && finalUrl !== url) {
          discovered.add(finalUrl);
          visited.add(finalUrl);
        }

        // Extract links from this page
        const links = await extractLinks(page);

        let newLinksCount = 0;
        for (const rawLink of links) {
          const normalized = normalizeUrl(rawLink, url, args.includeQuery);
          if (!normalized) continue;
          if (!isSameDomain(normalized, baseDomain)) continue;
          if (discovered.has(normalized)) continue;
          if (matchesExcludePattern(normalized, args.exclude)) {
            skippedCount++;
            continue;
          }

          discovered.add(normalized);
          queue.push([normalized, depth + 1]);
          newLinksCount++;
        }

        log(
          `  ${C.green}[${visited.size}/${args.maxPages}]${C.reset} ` +
          `d=${depth} ${url} ${C.dim}(+${newLinksCount} links)${C.reset}`,
          args.verbose
        );
      } catch (err) {
        errorCount++;
        log(
          `  ${C.red}[ERROR]${C.reset} ${url}: ${err instanceof Error ? err.message : String(err)}`,
          args.verbose
        );
      } finally {
        await page.close();
      }
    });

    await Promise.allSettled(promises);
  }

  await browser.close();

  // Sort discovered URLs for consistent output
  const sortedUrls = Array.from(discovered).sort();

  const duration = Date.now() - startTime;

  log('', true, true);
  log(`${C.bold}Crawl complete:${C.reset}`, true, true);
  log(`  ${C.green}Discovered: ${sortedUrls.length} unique URLs${C.reset}`, true, true);
  log(`  Visited: ${visited.size} pages`, true, true);
  log(`  Skipped: ${skippedCount}`, true, true);
  log(`  Errors: ${errorCount}`, true, true);
  log(`  Duration: ${(duration / 1000).toFixed(1)}s`, true, true);

  return {
    urls: sortedUrls,
    visited: visited.size,
    skipped: skippedCount,
    errors: errorCount,
    duration,
  };
}

// ─── Output ──────────────────────────────────────────────────────────────────

function writeOutput(result: CrawlResult, outputPath: string | null): void {
  const content = result.urls.join('\n') + '\n';

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, content, 'utf-8');
    log(`\n  ${C.cyan}Output written to: ${outputPath}${C.reset}`, true, true);
  } else {
    process.stdout.write(content);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (!args.startUrl) {
    console.error(`${C.red}Error: Start URL is required${C.reset}`);
    console.error('Usage: npx tsx Tools/Crawl.ts <start-url> [options]');
    console.error('Run with --help for full usage information.');
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(args.startUrl);
  } catch {
    console.error(`${C.red}Error: Invalid URL: ${args.startUrl}${C.reset}`);
    process.exit(1);
  }

  const result = await crawl(args);
  writeOutput(result, args.output);
}

main().catch((err) => {
  console.error(`${C.red}Fatal error: ${err.message || err}${C.reset}`);
  process.exit(1);
});
