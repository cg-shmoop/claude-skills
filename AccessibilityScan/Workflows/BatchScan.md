# BatchScan Workflow

Scans multiple URLs (up to 130+) for WCAG 2.2 AA accessibility violations. Generates per-page JSON and HTML reports plus an aggregate summary.json. Designed for full-site audits.

## Pre-flight Checklist

Before constructing the batch scan command, verify:

| Check | How | If Missing |
|-------|-----|------------|
| **URL file exists** | `ls <url-file-path>` | Create the URL file or ask user for the path |
| **URL file format is valid** | Read first few lines to verify format | See URL File Format below |
| **Auth state exists** (if authenticated site) | `ls ./auth-state.json` or user-specified path | Run the Authenticate workflow first |
| **Playwright installed** | `npx playwright install --dry-run` | Run `npx playwright install chromium` |
| **Output directory writable** | `ls <output-dir>` or it will be created | Verify parent directory exists |
| **Sufficient disk space** | Each page report is ~50-200KB | For 130 pages, expect ~25-50MB total |

**If the site requires authentication and no auth state file exists:** Stop and invoke the Authenticate workflow before proceeding.

## URL File Format

The URL file is a plain text file with one URL per line. Comments and blank lines are supported.

```
# Website Accessibility Audit
# Generated: 2026-02-11
# Total URLs: 134

https://example.com/dashboard
https://example.com/residents
https://example.com/residents/123
https://example.com/maintenance

# Admin Pages
https://example.com/admin/settings
https://example.com/admin/users

# Skip these for now (uncomment when ready)
# https://example.com/reports/annual
```

**Rules:**
- One URL per line
- Lines starting with `#` are comments (ignored)
- Blank lines are ignored
- URLs must be fully qualified (include `https://`)
- No trailing whitespace required (trimmed automatically)
- File encoding: UTF-8

## Intent-to-Flag Mapping

Map the user's request to Scan.ts CLI flags for batch mode:

| User Says | Flag | Example |
|-----------|------|---------|
| File containing URLs | `--batch <file>` | `--batch ./urls.txt` |
| Custom output directory | `--output <dir>` | `--output ./accessibility/2026/02` |
| Use saved auth session | `--auth <path>` | `--auth ./auth-state.json` |
| Control concurrency | `--parallel <n>` | `--parallel 3` |
| Only JSON reports | `--format json` | `--format json` |
| Only HTML reports | `--format html` | `--format html` |
| Detailed logging | `--verbose` | Shows per-page navigation info |

## Command Construction

### Basic Batch Scan (unauthenticated)

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts --batch ./urls.txt --output ./accessibility/2026/02
```

### Authenticated Batch Scan

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts \
  --batch ./urls.txt \
  --auth ./auth-state.json \
  --output ./accessibility/2026/02
```

### Batch Scan with Higher Concurrency

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts \
  --batch ./urls.txt \
  --auth ./auth-state.json \
  --output ./accessibility/2026/02 \
  --parallel 3
```

## Post-Scan: Read and Present Results

After the batch scan completes, **read the summary.json** file and present aggregate results.

### Step 1: Read summary.json

The batch scan generates `<output-dir>/summary.json` containing aggregate data. Read this file.

### Step 2: Present Top Violations Across All Pages

```
Batch Accessibility Scan Results
============================================================
URLs scanned:    134 / 134
Scan duration:   8m 42s
Pages with violations: 98 / 134 (73%)
Total violations: 847 instances across 23 unique rules

TOP VIOLATIONS (by frequency across all pages)
------------------------------------------------------------
 #  | Rule              | Impact   | Pages | Instances
 1  | color-contrast    | serious  | 89    | 312
 2  | image-alt         | critical | 45    | 156
 3  | link-name         | serious  | 42    | 98
 4  | label             | critical | 38    | 67
 5  | button-name       | critical | 31    | 54
```

### Step 3: Present Per-Page Violation Counts

Show the pages with the most violations (top 15-20).

### Step 4: Provide Remediation Priorities

Based on the aggregate data, recommend a remediation strategy:

1. **Site-wide fixes first** -- Issues appearing on every page (e.g., missing `lang` attribute, missing skip nav) should be fixed in the layout template for maximum impact with minimal effort
2. **Critical violations next** -- Fix `image-alt`, `button-name`, `label` across the site
3. **High-frequency serious violations** -- Address `color-contrast` systematically (may require design system changes)
4. **Page-specific issues** -- Fix remaining violations on the worst-scoring pages

### Step 5: Report File Paths

```
Reports generated:
  Summary:    ./<output-dir>/summary.json
  Per-page:   ./<output-dir>/pages/<page-slug>.json
  HTML:       ./<output-dir>/pages/<page-slug>.html
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `URL file not found` | Path to URL file is wrong | Verify path; use absolute path if relative fails |
| `Navigation timeout on <url>` | Single page took too long | Page is logged as failed in summary; check URL reachability |
| `Auth state expired mid-batch` | Session expired during long scan | Re-authenticate and re-run |
| `Out of memory` | Too many concurrent browser contexts | Reduce `--parallel` to 1 or 2 |
| `Partial results` | Some pages failed but others succeeded | Summary includes both; re-scan failed pages separately |
| `All pages show login page` | Auth state not loaded or expired | Verify `--auth` flag; re-authenticate if needed |

## Performance Notes

- **Default parallelism:** 5 pages at a time
- **Recommended for 130+ URLs:** `--parallel 3` (balanced speed and stability)
- **Estimated time:** ~3-5 seconds per page at parallel 1, ~1-2 seconds per page at parallel 3-5
- **Memory usage:** ~200-500MB at parallel 3; reduce if memory constrained
