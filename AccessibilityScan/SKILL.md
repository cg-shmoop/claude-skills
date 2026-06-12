---
name: AccessibilityScan
description: WCAG 2.2 AA accessibility scanning for web pages using axe-core and Playwright. USE WHEN accessibility, a11y, WCAG, ADA compliance, Section 508, accessibility audit, accessibility scan, web accessibility testing.
---

# AccessibilityScan

Automated WCAG 2.2 AA accessibility scanning powered by axe-core and Playwright. Scans single pages or batches of 130+ URLs, generates JSON and HTML reports, and summarizes violations by impact level. Supports authenticated scanning via saved browser session state.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/AccessibilityScan/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **Authenticate** | "login", "authenticate", "save session" | `Workflows/Authenticate.md` |
| **SinglePage** | "scan page", "check accessibility", single URL | `Workflows/SinglePage.md` |
| **BatchScan** | "scan all pages", "batch scan", "scan site", multiple URLs | `Workflows/BatchScan.md` |
| **DeepAudit** | "deep audit", "full audit", "click through and scan", "keyboard navigation test", "can a blind user...", "exam journey", "test the whole exam", interactive page, exam page, SPA requiring clicks | `Workflows/DeepAudit.md` |

## Examples

**Example 1: Scan a single page for accessibility violations**
```
User: "check the accessibility of https://dynhome.com/dashboard"
-> Invokes SinglePage workflow
-> Runs axe-core scan against the URL with WCAG 2.2 AA tags
-> Reads JSON results, summarizes violations by impact level
-> Reports critical/serious issues first, provides path to HTML report
```

**Example 2: Batch scan an entire site**
```
User: "scan all pages on dynhome for accessibility"
-> Invokes BatchScan workflow
-> Reads URL file (one URL per line)
-> Scans each page sequentially with axe-core
-> Generates per-page JSON + HTML reports and a summary.json
-> Presents top violations across all pages, per-page violation counts
```

**Example 3: Deep audit an interactive exam page**
```
User: "can a blind user take this ACT drill exam? do a full audit"
-> Invokes DeepAudit workflow
-> Authenticates, clicks "Start Drill" to enter exam content
-> Captures screenshot, CDP accessibility tree, tab order
-> Tests arrow key navigation in radiogroups
-> Runs axe-core WCAG analysis
-> Writes comprehensive AUDIT-REPORT.md with blind user journey assessment
```

**Example 4: Run a full exam journey accessibility test**
```
User: "test the whole ACT drill exam accessibility end to end"
-> Invokes DeepAudit workflow
-> Runs test-exam-journey.ts: answers questions, navigates back, tests edge cases
-> Submits exam, navigates to answer explanations page
-> Runs full a11y audit on results page (axe-core, CDP tree, tab order)
-> Reports 27+ test results across 10 phases with screenshots
```

**Example 5: Authenticate before scanning a protected site**
```
User: "log in to dynhome so I can scan the authenticated pages"
-> Invokes Authenticate workflow
-> Launches headed Playwright browser to login URL
-> User logs in manually in the browser window
-> Saves session state to auth-state.json for subsequent scans
-> Reports state file location and session validity
```

## Quick Reference

**WCAG 2.2 AA Tag Groups:**

| Tag | Description |
|-----|-------------|
| `wcag2a` | WCAG 2.0 Level A |
| `wcag2aa` | WCAG 2.0 Level AA |
| `wcag21a` | WCAG 2.1 Level A |
| `wcag21aa` | WCAG 2.1 Level AA |
| `wcag22aa` | WCAG 2.2 Level AA |
| `best-practice` | Common accessibility best practices |

**Default scan tags:** `wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa`

**Impact Levels (axe-core):**

| Level | Meaning |
|-------|---------|
| `critical` | Blocks access entirely for some users |
| `serious` | Significant barrier, difficult workaround |
| `moderate` | Some difficulty, workaround exists |
| `minor` | Annoyance, minimal impact |

**Output Formats:**
- **JSON** -- Machine-readable, per-page violation details with selectors, HTML snippets, and WCAG tags
- **HTML** -- Human-readable report with expandable violation cards, screenshots, and remediation guidance
- **summary.json** -- Batch-only aggregate: top violations, per-page counts, pass/fail totals

**CLI Tools:**
- `Tools/Scan.ts` -- Core scanning engine (see `Tools/Scan.help.md`)
- `Tools/Authenticate.ts` -- Session capture for authenticated scanning (see `Tools/Authenticate.help.md`)

## Playwright MCP Integration

The **Playwright MCP server** (`@playwright/mcp`) is configured in `~/.claude/settings.json` and provides interactive browser access with the accessibility tree as its primary interaction model. It uses the same `auth-state.json` session file as this skill's scanner.

**What Playwright MCP adds:**
- `browser_snapshot` -- Returns the full accessibility tree (roles, names, states) as structured data
- `browser_navigate`, `browser_click`, `browser_type` -- Interact with pages using accessibility tree references
- `browser_take_screenshot` -- Visual verification
- `browser_evaluate` -- Run JavaScript (e.g., inject axe-core for ad-hoc checks)

**Workflow: Use both tools together**
1. **Playwright MCP** for interactive debugging -- navigate, inspect the a11y tree, click around, verify ARIA attributes live
2. **AccessibilityScan** for formal WCAG audits -- batch scans, HTML reports, violation tracking over time

**Auth state sharing:** Both tools consume the same `auth-state.json` (standard Playwright storageState format). Run the Authenticate workflow once, and both tools have access to authenticated pages.

**Re-authentication:** If sessions expire, run the Authenticate workflow to regenerate `auth-state.json`. Both Playwright MCP (on next restart) and AccessibilityScan will pick up the new session.

## Full Documentation

For complete WCAG 2.2 AA reference material including success criteria, legal context, impact definitions, and remediation patterns, see `WcagReference.md`.
