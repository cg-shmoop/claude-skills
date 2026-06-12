---
name: SinglePage
description: Test a single web page from the braille user perspective
---

# SinglePage Workflow

## Trigger
- "braille test {URL}"
- "braille test app.example.com"
- "test braille navigation on {URL}"

## Input
- **url** (required): The URL to test
- **task** (optional): Specific task to accomplish (default: "orientation scan")
- **auth** (optional): Whether to authenticate first (auto-detected for app.example.com)

## Steps

1. **Launch browser** with Playwright (Chromium, accessibility enabled)
2. **Authentication** (if needed):
   - For app.example.com: Use test credentials to log in via braille navigation
   - Records the login flow as a separate session transcript
3. **Navigate to URL**
4. **Run orientation strategy**: Read title → List headings → Scan landmarks → Jump to main → Linear scan
5. **Run assessment rules**: heading-structure, landmark-presence, form-labels, link-purpose, navigation-cost
6. **Generate session transcript**: JSON + Markdown in braille-tests/YYYY-MM/domain/sessions/
7. **Regenerate summary**: Aggregate all sessions for this domain/month

## Output
- `{timestamp}-{task-slug}.json` — Machine-readable session
- `{timestamp}-{task-slug}.md` — Human-readable transcript
- `{timestamp}-{task-slug}-findings.json` — Extracted findings
- `summary.json` / `summary.md` — Regenerated aggregate

## Example
```
braille test https://app.example.com/student/assignments
```
