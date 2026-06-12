# CrawlSite Workflow

Discover all user-facing pages on a website using browser-based link following.

## Pre-Flight Checklist

1. **Playwright installed?** — Check: `cd ~/.claude/skills/AccessibilityScan && npx playwright install chromium` if needed
2. **Authentication needed?** — If the site requires login, ensure auth state exists at `~/.claude/skills/AccessibilityScan/auth-state.json`. If not, run the AccessibilityScan Authenticate workflow first.
3. **Determine scope:**
   - Start URL (e.g., `https://app.example.com`)
   - Max depth (default: 5)
   - Max pages (default: 500)
   - Exclude patterns (e.g., `/api/`, `/logout`, `/admin/`)
   - Include query params? (default: no)
   - Use sitemap? (recommended for first crawl)

## Execution

### Step 1: Run the crawler

```bash
npx tsx ~/.claude/skills/SiteCrawler/Tools/Crawl.ts <START_URL> \
  [--auth ~/.claude/skills/AccessibilityScan/auth-state.json] \
  [--sitemap] \
  [--exclude "/api/" --exclude "/logout"] \
  [--depth 5] \
  [--max-pages 500] \
  [--parallel 3] \
  [--verbose] \
  --output <OUTPUT_PATH>/urls.txt
```

**Output path convention:** Use the project's accessibility directory:
```
accessibility/YYYY/MM/urls.txt
```

### Step 2: Review discovered URLs

Read the output file and check:
- Total count is reasonable for the site
- No obvious duplicates or junk URLs
- Protected pages are included (if auth was used)
- No external domains leaked through

### Step 3: Feed into AccessibilityScan (optional)

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts \
  --batch <OUTPUT_PATH>/urls.txt \
  [--auth ~/.claude/skills/AccessibilityScan/auth-state.json] \
  --output <OUTPUT_PATH>/scan-results
```

## Common Configurations

### Public site, full crawl
```bash
npx tsx ~/.claude/skills/SiteCrawler/Tools/Crawl.ts https://www.example.com \
  --sitemap --depth 5 --max-pages 500 -o urls.txt
```

### Authenticated site, exclude noise
```bash
npx tsx ~/.claude/skills/SiteCrawler/Tools/Crawl.ts https://app.example.com \
  --auth ~/.claude/skills/AccessibilityScan/auth-state.json \
  --sitemap \
  --exclude "/api/" --exclude "/logout" --exclude "/print/" \
  --depth 5 --max-pages 500 \
  -v -o urls.txt
```

### Quick discovery (shallow)
```bash
npx tsx ~/.claude/skills/SiteCrawler/Tools/Crawl.ts https://example.com \
  --depth 2 --max-pages 50 -o urls.txt
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Browser not found | `cd ~/.claude/skills/AccessibilityScan && npx playwright install chromium` |
| Auth expired | Re-run AccessibilityScan Authenticate workflow |
| Too many URLs | Add `--exclude` patterns, reduce `--depth` or `--max-pages` |
| Missing pages | Enable `--sitemap`, increase `--depth` |
| Slow crawl | Reduce `--depth`, increase `--parallel` (watch memory) |
