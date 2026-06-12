---
name: BrailleTest
description: >
  JAWS braille screen reader testing agent. Navigates websites as a blind
  braille display user would, detecting accessibility failures that automated
  scanners like axe-core cannot find. Simulates a 40-cell refreshable braille
  display with JAWS navigation commands.
  USE WHEN braille test, screen reader test, JAWS test, braille navigation,
  blind user test, assistive technology test, braille audit, screen reader audit.
version: 1.0.0
---

# BrailleTest

Tests websites from the perspective of a blind user with a 40-cell refreshable braille display using JAWS screen reader navigation.

## What It Does

- Navigates pages using only JAWS keyboard commands (heading nav, landmarks, tab, form fields)
- Simulates a 40-cell braille display — sees only 40 characters at a time
- Records every braille display state, command, and agent decision in a human-readable transcript
- Detects accessibility failures invisible to automated scanners: missing headings, unlabeled forms, excessive navigation cost, silent dynamic content
- Produces session logs that show exactly what a braille user would experience

## What It Does NOT Do

- Does not replace axe-core scanning (complementary, not duplicative)
- Does not test visual accessibility (color contrast, text size)
- Does not emulate speech-only screen reader users (braille-specific)

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| SinglePage | "braille test [URL]" | Test one page with orientation + optional form completion |
| BatchTest | "braille test all pages" | Test multiple pages from a URL list (Phase 4) |
| TaskFlow | "test if a braille user can [task]" | Multi-page user journey (Phase 4) |

## Requirements

- Windows (for UI Automation APIs)
- .NET 8 Runtime (for UIA adapter)
- Node.js / Bun (for TypeScript orchestrator)
- JAWS (optional — enhanced fidelity when present)

## Output

Session transcripts saved to:
```
C:\projects\accessibility-audits\braille-tests\YYYY-MM\domain\sessions\
```
