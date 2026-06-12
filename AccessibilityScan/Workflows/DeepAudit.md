# DeepAudit Workflow

Comprehensive accessibility audit for interactive pages that require click-through navigation before content loads. Captures screenshots, CDP accessibility tree, keyboard tab order, and axe-core violations in a single pass. Designed for authenticated SPAs, exam pages, and wizard-style flows.

## When to Use This Workflow

Use DeepAudit instead of SinglePage when:
- The page requires clicking a button (e.g., "Start Drill", "Begin Exam") before real content loads
- You need the CDP accessibility tree, not just axe-core violations
- You need keyboard tab order verification
- You need to test arrow key navigation within custom widgets (radiogroups, menus)
- The page is an SPA where the URL doesn't change after interaction

## Pre-flight Checklist

| Check | How | If Missing |
|-------|-----|------------|
| **URL provided** | User specified a URL | Ask using AskUserQuestion |
| **Auth state exists** | `ls ~/.claude/skills/AccessibilityScan/auth-state.json` | Run Authenticate workflow first |
| **Click-through selector** | User describes what to click (e.g., "Start Drill") | Default: `text=Start Drill` |
| **Playwright installed** | Already in skill's node_modules | Should be present |

## Scripts

Two custom scripts power this workflow. They live in the auditing project but use the skill's node_modules via `NODE_PATH`.

### scan-after-click.ts — Full Page Audit

**Location:** Project's `scripts/scan-after-click.ts`
**Purpose:** Navigate to URL, click through to content, capture screenshot + a11y tree + tab order + axe-core

**Usage:**
```bash
NODE_PATH="$HOME/.claude/skills/AccessibilityScan/node_modules" \
  npx tsx scripts/scan-after-click.ts \
  "<url>" "<button-selector>" \
  --auth ~/.claude/skills/AccessibilityScan/auth-state.json \
  --output <output-dir>
```

**Outputs:**
| File | Description |
|------|-------------|
| `01-pre-click.png` | Screenshot before clicking through |
| `02-exam-content.png` | Full page screenshot after click |
| `03-exam-viewport.png` | Viewport-only screenshot |
| `accessibility-tree-raw.json` | Full CDP accessibility tree (all nodes) |
| `accessibility-tree-readable.txt` | Human-readable tree (roles, names, values) |
| `tab-navigation-order.json` | Tab stops with focus visibility data |
| `tab-navigation-order.txt` | Human-readable tab order |
| `axe-results.json` | axe-core WCAG 2.2 AA analysis |

### test-keyboard-nav.ts — Keyboard Interaction Testing

**Location:** Project's `scripts/test-keyboard-nav.ts`
**Purpose:** Test arrow key navigation in radiogroups, Space/Enter selection, full tab cycle, screen reader announcement simulation

**Usage:**
```bash
NODE_PATH="$HOME/.claude/skills/AccessibilityScan/node_modules" \
  npx tsx scripts/test-keyboard-nav.ts \
  "<url>" \
  --auth ~/.claude/skills/AccessibilityScan/auth-state.json \
  --output <output-dir>
```

**Tests performed:**
1. Radiogroup structure and `aria-checked` states
2. Arrow key navigation (Up/Down with wrap detection)
3. Space/Enter answer selection
4. Complete Tab cycle (all reachable controls)
5. Simulated screen reader announcements

**Outputs:**
| File | Description |
|------|-------------|
| `keyboard-nav-test-results.json` | All interaction test data |

## NODE_PATH Requirement

Both scripts import `playwright` and `axe-core` which are installed in the AccessibilityScan skill's `node_modules`. Since the scripts live in the project directory (not the skill directory), Node.js module resolution won't find them by default.

**Solution:** Prefix commands with `NODE_PATH`:
```bash
NODE_PATH="$HOME/.claude/skills/AccessibilityScan/node_modules" npx tsx <script>
```

This tells Node.js to also search the skill's node_modules when resolving imports. Without this, you'll get `Cannot find module 'playwright'`.

## Workflow Steps

### Step 1: Authenticate (if needed)
If the target requires login, run the Authenticate workflow first.

### Step 2: Run scan-after-click.ts
```bash
NODE_PATH="$HOME/.claude/skills/AccessibilityScan/node_modules" \
  npx tsx scripts/scan-after-click.ts \
  "https://example.com/exam/start" "text=Begin Exam" \
  --auth ~/.claude/skills/AccessibilityScan/auth-state.json \
  --output scans/YYYY-MM/site-name
```

### Step 3: Run test-keyboard-nav.ts
```bash
NODE_PATH="$HOME/.claude/skills/AccessibilityScan/node_modules" \
  npx tsx scripts/test-keyboard-nav.ts \
  "https://example.com/exam/start" \
  --auth ~/.claude/skills/AccessibilityScan/auth-state.json \
  --output scans/YYYY-MM/site-name
```

### Step 4: Analyze Results

Read and analyze the output files:

1. **Screenshot** — Verify the correct page was captured (not a login page or loading state)
2. **Accessibility tree** — Check for:
   - Missing roles or names on interactive elements
   - aria-label overriding content (common trap with custom widgets)
   - Elements absent from the tree (aria-hidden or display:none)
3. **Tab order** — Verify:
   - All interactive controls are reachable
   - Logical order matches visual layout
   - Focus visibility on all tab stops
4. **Keyboard nav** — Check:
   - Arrow keys work within radiogroups/menus
   - Selection state updates on arrow (or not — document which)
   - Space/Enter activates correctly
5. **axe-core** — Standard violation analysis by impact level

### Step 5: Write Audit Report

Generate a comprehensive `AUDIT-REPORT.md` with:
- Executive summary (can a user complete the task?)
- Findings by severity (Critical/Moderate/Minor)
- Blind user journey assessment (step-by-step walkthrough)
- What works well
- Test artifacts inventory

### Step 4 (Extended): Run test-exam-journey.ts — Full Exam Journey Test

For exam/drill products, use the comprehensive journey test that simulates a complete blind user flow:

```bash
NODE_PATH="$HOME/.claude/skills/AccessibilityScan/node_modules" \
  npx tsx scripts/test-exam-journey.ts \
  "<url>" \
  --auth ~/.claude/skills/AccessibilityScan/auth-state.json \
  --output scans/YYYY-MM/journey
```

**This script runs 10 phases with 27+ test assertions:**
1. Start drill/exam
2. Answer Q1 via mouse click — verify aria-checked, roving tabindex, aria-describedby
3. Answer Q2 via keyboard (ArrowDown + Space) — verify label content
4. Back navigation — verify answer persistence
5. Edge cases — deselect (click same answer), reselect different, flag question
6. Answer remaining questions
7. Submit exam — "I'm Done" → modal verification → click Submit
8. Navigate to answer explanations page
9. Full a11y audit on results page (axe-core, CDP tree, tab order)
10. Results page interactions — expand accordion cards, verify explanation content, re-scan

**Outputs:**
| File | Description |
|------|-------------|
| `exam-journey-report.json` | Comprehensive JSON with all phases, tests, pass/fail |
| `00-pre-start.png` through `09-results-expanded.png` | Screenshots at every phase |
| `results-page-axe.json` | axe-core scan of the post-submission results page |
| `results-page-a11y-tree.json` | CDP accessibility tree of the results page |
| `results-page-tab-order.json` | Tab order on the results page |

**When to use this vs individual scripts:** Use `test-exam-journey.ts` for regression testing after fixes. Use `scan-after-click.ts` + `test-keyboard-nav.ts` for initial audits when you need to study the raw data.

## Key Learnings from Real Audits

### aria-label Override Trap
`aria-label` on a parent element **overrides** accessible name computation from child content. A radio button with `aria-label="Answer F"` will announce only "Answer F" even if it contains rich text and MathJax math. The computed accessible name in the CDP tree confirms this. **Fix:** Use `aria-labelledby` pointing to visible content, or extend `aria-label` to include full content.

### MathJax Async Race Condition
MathJax renders asynchronously. If you set custom `aria-label` attributes before MathJax finishes typesetting, MathJax may clobber them on re-render. **Fix:** Hook into `MathJax.typesetPromise()` or configure MathJax's built-in a11y extension instead.

### Custom Widget vs Native HTML
`<button role="radio">` requires manual keyboard handling, aria-checked management, and roving tabindex. Native `<input type="radio">` gets all this for free from the browser. When auditing custom ARIA widgets, always ask: "Could this be native HTML instead?"

### "I'm Done" Pattern
Buttons that exist in the DOM but are missing from the CDP accessibility tree AND the tab order may be conditionally hidden. Audit the JavaScript controlling visibility before assuming it's a simple tabindex fix.

### Color Contrast: Always Compute, Never Eyeball
"Close enough" fails axe-core. Example: `#78849c` bg with white text is 4.49:1 — technically fails 4.5:1. Even `#6e7b96` (~4.3:1) failed. The safe fix was `#636f8c` (~5.0:1). **Rule:** When fixing contrast, target at least 5:1 to leave margin. Use the WCAG relative luminance formula, not visual judgment.

### MathJax Tab Stop Neutralization
MathJax creates two types of focusable elements that steal tab order from custom widgets:
1. `mjx-container[tabindex]` — the math rendering container
2. `mjx-speech[role="application"]` — the speech/a11y overlay

**Fix:** Use a `MutationObserver` to set `tabindex="-1"` on both. Observe with `{ childList: true, subtree: true, attributes: true, attributeFilter: ['tabindex'] }` because MathJax re-renders asynchronously and may reset tabindex values.

### ARIA Radiogroup: Navigate-Then-Select Pattern
For exam contexts where auto-select on arrow key is risky (answers may be recorded server-side on selection change), use Option B:
- Keep arrow keys as focus-only (no auto-select)
- Add `aria-describedby` on the radiogroup pointing to instructions: "Use arrow keys to navigate options. Press Space to select."
- This is a documented APG deviation, justified for exam integrity.

### Answer Labels Must Include Content
`aria-label="Answer F"` is insufficient — blind users can't determine what each choice is. **Fix:** Build labels as `"Answer F: {plainTextContent}"`. For MathJax answers, hook into `typesetPromise()` to extract rendered alt text. For plain text, parse the HTML to extract `textContent`. Use a priority chain: MathJax labels → text extraction → letter-only fallback.

### Tab Order Cycle Detection in Test Scripts
When writing automated tab-order tests, **never** use simple matching (just tag + id) for cycle detection. Multiple `<button>` elements with empty `id` and `aria-label` will false-match. **Fix:** Use composite keys: `tag|role|ariaLabel|text`. Require at least 4-5 elements before checking for cycles.

### page.evaluate() vs Playwright Selectors
Inside `page.evaluate()`, you're in the **browser's DOM API** — only native `querySelector` syntax works. Playwright-specific selectors like `:has-text()`, `text=`, `role=` will throw `SyntaxError`. **Fix:** Use `Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('...'))` instead.

### SPA Link Discovery: Crawlers Can't See JS-Rendered Links
BFS crawlers (including SiteCrawler) may find 0 links on React SPAs because links are rendered client-side after JavaScript executes. The crawler fetches the HTML before React hydrates.

**Fix:** Use Playwright directly with `page.evaluate()` to extract links from the rendered DOM:
```javascript
const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => h.startsWith('http'))
);
```
For multi-level discovery, visit each discovered page and extract its links too. This builds a complete URL list for batch scanning.

### Document Title Race Condition in SPAs
React SPAs that set `document.title` via `useEffect` on route change may have an empty title at the moment axe-core runs — the effect hasn't fired yet. axe-core reports `document-title` violation (WCAG 2.4.2).

**Fix:** Add a default `<title>` in the HTML template (e.g., webpack's HtmlWebpackPlugin `templateContent`). React will override it dynamically, but axe-core and screen readers always have a fallback.

### Inherited Global CSS Overrides
Violations may come from shared/global CSS files outside the project's SCSS build pipeline (e.g., `public/common/src/css/styles.css`). The color `#2e9bee` on links is defined globally as `a:not(.btn) { color: #2e9bee; }` — this fails 4.5:1 contrast on light backgrounds.

**Fix:** Override in the project's SCSS with higher specificity. Example: `.test-prep-react-wrapper footer a { color: #006595; }` achieves ~5.5:1 on `#eceff1`. Don't modify the shared CSS — it affects other products.

### Decorative Images in Modals
Images in modals/overlays (e.g., heartbeat "Are you still there?" modal) are in the DOM even when hidden. axe-core finds them regardless. Decorative images need `alt=""` to pass WCAG 1.1.1.

**Pattern:** Search for `<img` without `alt` across all `.jsx` files: any `<img>` without `alt` is a potential violation, even if it's in a rarely-seen modal.

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Cannot find module 'playwright'` | NODE_PATH not set | Add `NODE_PATH="$HOME/.claude/skills/AccessibilityScan/node_modules"` prefix |
| `Could not find button` | Click-through selector doesn't match | Script dumps all interactive elements — use those to find the correct selector |
| `Only 1 node in a11y tree` | CDP `Accessibility.enable` not called | Script handles this automatically; if still 1 node, page may not have loaded |
| `Auth state expired` | Session cookies have expired | Re-run Authenticate workflow |
