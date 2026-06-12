---
name: SiteCrawler
description: Browser-based site crawler for URL discovery. USE WHEN crawl site, discover pages, find URLs, enumerate pages, site map, list all pages, URL discovery, crawl for accessibility, find all links on site.
---

# SiteCrawler

Discovers user-facing pages on a website by following internal links with a real browser (Playwright). Outputs a deduplicated URL list ready for AccessibilityScan's `--batch` mode.

## Customization

Check `~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/SiteCrawler/` for user overrides.

## Voice Notification

**When executing a workflow, do BOTH:**

1. **Send voice notification**:

2. **Output text notification**:
   ```
   Running the **CrawlSite** workflow in the **SiteCrawler** skill to discover pages...
   ```

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **CrawlSite** | "crawl site", "discover pages", "find all URLs", "enumerate pages", "list pages for scanning" | `Workflows/CrawlSite.md` |

## Examples

**Example 1: Crawl for accessibility batch scan**
```
User: "Crawl app.example.com and find all pages for an accessibility scan"
-> Invokes CrawlSite workflow
-> Launches Playwright, follows internal links BFS from homepage
-> Outputs urls.txt with all discovered pages
-> User runs AccessibilityScan --batch urls.txt
```

**Example 2: Authenticated crawl with sitemap**
```
User: "Crawl the logged-in site, use the sitemap too"
-> Invokes CrawlSite workflow with --auth and --sitemap flags
-> Loads saved auth state, parses sitemap.xml for seed URLs
-> Follows links from both sitemap and on-page anchors
-> Outputs comprehensive URL list including protected pages
```

**Example 3: Targeted shallow crawl**
```
User: "Quick crawl of example.com, just the top 50 pages"
-> Invokes CrawlSite workflow with --depth 2 --max-pages 50
-> Fast shallow crawl, outputs first 50 unique pages found
```

## Quick Reference

| Feature | Detail |
|---------|--------|
| **Runtime** | `npx tsx` (NOT bun) |
| **Browser** | Playwright Chromium (headless) |
| **Algorithm** | BFS (breadth-first, closest pages first) |
| **Auth** | Playwright storage state JSON (same as AccessibilityScan) |
| **Sitemap** | Optional: `--sitemap` parses sitemap.xml as seed URLs |
| **Output** | One URL per line, sorted, deduplicated |
| **Defaults** | depth=5, max-pages=500, parallel=3 |
| **Filters** | Strips fragments, query params; skips images/PDFs/scripts |
| **Exclusions** | `--exclude` flag (repeatable) for URL patterns |

## Pipeline Integration

```
SiteCrawler (discover URLs) -> urls.txt -> AccessibilityScan --batch (scan all)
```
