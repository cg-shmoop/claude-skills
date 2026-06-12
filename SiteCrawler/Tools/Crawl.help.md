# Crawl.ts — Browser-Based Site Crawler

Discovers user-facing pages on a website by following internal links using a real browser (Playwright). Outputs a clean URL list for accessibility scanning.

## Runtime

```bash
npx tsx Tools/Crawl.ts <start-url> [options]
```

**Important:** Use `npx tsx`, NOT `bun`. Bun hangs on Playwright browser launch on Windows.

## CLI Flags

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `<start-url>` | | positional | (required) | URL to start crawling from |
| `--auth` | `-a` | string | — | Path to Playwright storage state JSON |
| `--output` | `-o` | string | stdout | Output file path for discovered URLs |
| `--depth` | `-d` | number | 5 | Max link-following depth from start URL |
| `--max-pages` | `-m` | number | 500 | Max pages to visit |
| `--sitemap` | `-s` | flag | false | Also parse sitemap.xml for URL discovery |
| `--exclude` | `-e` | string | — | URL pattern to exclude (repeatable) |
| `--include-query` | | flag | false | Keep query parameters in URLs |
| `--parallel` | `-p` | number | 3 | Concurrent page visits |
| `--verbose` | `-v` | flag | false | Show detailed crawl progress |
| `--help` | `-h` | flag | false | Show help message |

## Examples

### Basic crawl
```bash
npx tsx Tools/Crawl.ts https://app.example.com -o urls.txt
```

### Authenticated crawl with sitemap seeding
```bash
npx tsx Tools/Crawl.ts https://app.example.com \
  --auth ~/.claude/skills/AccessibilityScan/auth-state.json \
  --sitemap \
  --exclude "/api/" --exclude "/logout" \
  -o urls.txt
```

### Shallow crawl with low page limit
```bash
npx tsx Tools/Crawl.ts https://example.com -d 2 -m 50 -v -o urls.txt
```

### Pipe directly to AccessibilityScan
```bash
npx tsx Tools/Crawl.ts https://example.com -o urls.txt && \
npx tsx ../AccessibilityScan/Tools/Scan.ts --batch urls.txt
```

## Output Format

One fully-qualified URL per line:
```
https://app.example.com/
https://app.example.com/about
https://app.example.com/courses
https://app.example.com/dashboard
```

- Deduplicated (no repeats)
- Sorted alphabetically
- Fragments stripped (#anchors removed)
- Query parameters stripped by default (use `--include-query` to keep)
- Non-page resources excluded (images, PDFs, scripts, etc.)

## Crawl Behavior

- **BFS (Breadth-First Search)** — visits pages closest to start URL first
- **Same-domain only** — never follows links to external sites
- **Respects depth limit** — stops following links beyond `--depth`
- **Handles redirects** — captures final URL after redirect chain
- **Skips non-pages** — images, PDFs, scripts, stylesheets, fonts, etc.
- **Skips special schemes** — mailto:, tel:, javascript:, data:, etc.

## Authentication

Uses the same Playwright storage state format as AccessibilityScan:

```bash
# Capture auth state first (via AccessibilityScan)
npx tsx ../AccessibilityScan/Tools/Authenticate.ts

# Then crawl with it
npx tsx Tools/Crawl.ts https://app.example.com \
  --auth ~/.claude/skills/AccessibilityScan/auth-state.json \
  -o urls.txt
```

## Sitemap Support

The `--sitemap` flag fetches sitemap.xml before crawling and seeds the URL queue:

1. Tries `/sitemap.xml`, `/sitemap_index.xml`, `/sitemap/`
2. Parses `<loc>` tags from urlset and sitemapindex
3. Follows one level of sub-sitemap references
4. Seeds all discovered URLs into the crawl queue at depth 0

This combines sitemap coverage with link-following for maximum discovery.

## Troubleshooting

**"Playwright browser not found"**
```bash
cd ~/.claude/skills/AccessibilityScan && npx playwright install chromium
```

**Crawl too slow**
- Reduce `--depth` (default 5 → try 3)
- Reduce `--max-pages` (default 500 → try 100)
- Increase `--parallel` (default 3 → try 5, but watch memory)

**Too many URLs from dynamic pages**
- Use `--exclude` to filter patterns: `-e "/search?" -e "/filter?" -e "/sort="`
- Disable query params: don't use `--include-query`

**Auth state expired**
- Re-run AccessibilityScan's Authenticate workflow to capture fresh state
