# SinglePage Workflow

Scans a single URL for WCAG 2.2 AA accessibility violations using axe-core, generates JSON and HTML reports, and presents a prioritized summary of findings.

## Pre-flight Checklist

Before constructing the scan command, verify:

| Check | How | If Missing |
|-------|-----|------------|
| **URL provided** | User specified a URL to scan | Ask for the URL using AskUserQuestion |
| **Auth state exists** (if authenticated site) | `ls ./auth-state.json` or user-specified path | Run the Authenticate workflow first |
| **Playwright installed** | `npx playwright install --dry-run` | Run `npx playwright install chromium` |
| **Target is reachable** | URL responds to requests | Verify URL, check VPN, confirm server is running |

**If the site requires authentication and no auth state file exists:** Stop and invoke the Authenticate workflow before proceeding.

## Intent-to-Flag Mapping

Map the user's request to Scan.ts CLI flags:

| User Says | Flag | Example |
|-----------|------|---------|
| URL to scan | `<url>` (positional) | `https://example.com/dashboard` |
| Custom output directory | `--output <dir>` | `--output ./accessibility/2026/02` |
| Use saved auth session | `--auth <path>` | `--auth ./auth-state.json` |
| Only JSON reports | `--format json` | `--format json` |
| Only HTML reports | `--format html` | `--format html` |
| Detailed logging | `--verbose` | Shows navigation details |

## Command Construction

### Basic Scan (unauthenticated)

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts https://example.com/page
```

### Scan with Custom Output Directory

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts https://example.com/page \
  --output ./accessibility/2026/02
```

### Authenticated Scan

```bash
npx tsx ~/.claude/skills/AccessibilityScan/Tools/Scan.ts https://example.com/dashboard \
  --auth ./auth-state.json \
  --output ./accessibility/2026/02
```

## Post-Scan: Read and Summarize Results

After the scan completes, **read the JSON output file** and present results to the user.

### Step 1: Read the JSON Report

The scan outputs a JSON file at the path reported by the tool (default: `<tmpdir>/accessibility-scan-results/<slug>.json`). Read this file.

### Step 2: Summarize Violations by Impact

Present violations grouped by impact level, starting with the most severe:

```
Accessibility Scan Results: https://example.com/dashboard
============================================================

CRITICAL (2 violations, 5 instances)
  - image-alt: Images must have alternative text
    SC 1.1.1 | 3 instances
    Selectors: img.hero-photo, img.team-1, img.team-2

  - button-name: Buttons must have discernible text
    SC 4.1.2 | 2 instances
    Selectors: button.icon-close, button.icon-menu

SERIOUS (4 violations, 12 instances)
  - color-contrast: Elements must meet minimum color contrast ratio thresholds
    SC 1.4.3 | 8 instances
    Worst ratio: 2.1:1 (requires 4.5:1)

  - link-name: Links must have discernible text
    SC 2.4.4 | 2 instances
    Selectors: a.social-icon, a.footer-link

  - label: Form elements must have labels
    SC 1.3.1 | 1 instance
    Selector: input#search

  - html-has-lang: <html> element must have a lang attribute
    SC 3.1.1 | 1 instance

MODERATE (2 violations, 3 instances)
  - heading-order: Heading levels should only increase by one
    SC 1.3.1 | 2 instances
  - region: All page content should be contained by landmarks
    SC 2.4.1 | 1 instance

MINOR (1 violation, 1 instance)
  - tabindex: Elements should not have tabindex greater than zero
    SC 2.4.3 | 1 instance

------------------------------------------------------------
Total: 9 violations | 21 instances
  Critical: 2 | Serious: 4 | Moderate: 2 | Minor: 1
Passes: 45 rules passed
Incomplete: 3 rules need manual review

Reports:
  JSON: ./accessibility/2026/02/dashboard.json
  HTML: ./accessibility/2026/02/dashboard.html
```

### Step 3: Highlight Critical and Serious Issues

After the summary table, call out the most impactful issues with brief remediation guidance:

- For **critical** violations: Provide the specific fix (e.g., "Add `alt` attributes to these 3 images")
- For **serious** violations: Identify the pattern and suggest a fix approach
- Reference `WcagReference.md` remediation patterns for detailed code examples

### Step 4: Report File Paths

Always end with the paths to generated reports:

```
Reports generated:
  JSON: ./<output-dir>/<slug>.json
  HTML: ./<output-dir>/<slug>.html
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Navigation timeout` | Page took too long to load | Check if URL requires auth; verify URL is reachable |
| `Auth state expired` | Session cookies have expired | Re-run the Authenticate workflow |
| `Page redirected to login` | Auth state not provided or expired | Provide `--auth` flag or re-authenticate |
| `No violations found` | Page passes all checked rules | Report as clean; note that manual testing is still recommended for criteria axe cannot automate |
| `Incomplete results` | axe could not determine pass/fail for some rules | Flag these for manual review; they are not failures but need human judgment |
