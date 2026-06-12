# Scan.ts

WCAG 2.2 AA accessibility scanner powered by axe-core and Playwright. Scans single pages or batches of URLs, producing JSON and HTML reports with violation details, selectors, and remediation guidance.

## Usage

```
npx tsx Scan.ts <url> [flags]
npx tsx Scan.ts --batch <file> [flags]
```

**Single page:**
```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts https://example.com/page
```

**Batch (multiple URLs):**
```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts --batch ./urls.txt
```

## Flags

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `<url>` | | positional | -- | Single URL to scan (mutually exclusive with `--batch`) |
| `--batch` | `-b` | string | -- | Path to text file with one URL per line (batch mode) |
| `--auth` | `-a` | string | -- | Path to Playwright storage state JSON (from Authenticate.ts) |
| `--format` | `-f` | string | `both` | Output format: `json`, `html`, or `both` |
| `--output` | `-o` | string | `<tmpdir>/accessibility-scan-results` | Output directory for reports |
| `--parallel` | `-p` | number | `5` | Concurrent pages in batch mode |
| `--verbose` | `-v` | boolean | `false` | Enable detailed logging |
| `--help` | `-h` | boolean | `false` | Show help message |

## Examples

### 1. Basic single-page scan

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts https://example.com
```

Scans the page with default WCAG 2.2 AA tags. Outputs to system temp directory:
- `example-com.json`
- `example-com.html`

### 2. Scan with custom output directory

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts https://example.com \
  --output ./accessibility/2026/02
```

Saves reports directly into the project's accessibility tracking folder.

### 3. Authenticated scan

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts https://example.com/dashboard \
  --auth ./auth-state.json \
  --output ./accessibility/2026/02
```

Loads the saved session, scans the dashboard page.

### 4. Batch scan of entire site

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts \
  --batch ./urls.txt \
  --auth ./auth-state.json \
  --output ./accessibility/2026/02 \
  --parallel 3
```

Scans all URLs in the file, 3 at a time. Generates per-page reports in `pages/` subdirectory plus `summary.json`.

### 5. JSON-only output

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts https://example.com --format json
```

Generates only JSON reports (no HTML).

## Filename Sanitization

URLs are converted to clean filenames:
- Protocol stripped (`https://` removed)
- Special characters (`/ \ ? & # = : * " < > | .`) replaced with `-`
- Consecutive dashes collapsed to single dash
- Leading/trailing dashes trimmed
- Capped at 200 characters

**Examples:**
| URL | Filename |
|-----|----------|
| `https://example.com` | `example-com.json` |
| `https://example.com/dashboard` | `example-com-dashboard.json` |
| `https://example.com/users/123/edit` | `example-com-users-123-edit.json` |
| `https://app.example.com/page?id=5&tab=settings` | `app-example-com-page-id-5-tab-settings.json` |

## Output Structure

### Single page mode
```
<output-dir>/
  <url-slug>.json
  <url-slug>.html
```

### Batch mode
```
<output-dir>/
  summary.json
  pages/
    <url-slug>.json
    <url-slug>.html
    ...
```

## Troubleshooting

### Browser fails to launch

```
Error: browserType.launch: Executable doesn't exist
```

**Fix:** Install Playwright browsers:
```bash
bunx playwright install chromium
```

### Navigation timeout

```
Error: page.goto: Timeout 30000ms exceeded
```

**Fix:** Check that the URL is reachable. The navigation timeout is 30 seconds.

### Authentication required (redirect to login)

The scan completes but results look wrong -- all pages have the same violations, or the scanned URL differs from the target.

**Fix:** Provide auth state:
```bash
npx tsx Scan.ts https://example.com/dashboard --auth ./auth-state.json
```

If auth state is expired, re-run the Authenticate workflow.

### Out of memory during batch scan

```
Error: JavaScript heap out of memory
```

**Fix:** Reduce parallelism:
```bash
npx tsx Scan.ts --batch ./urls.txt --parallel 1
```
