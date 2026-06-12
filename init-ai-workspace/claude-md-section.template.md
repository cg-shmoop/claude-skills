<!-- knowledge-system -->
## Knowledge system

Durable knowledge lives in-repo, visible, git-tracked.

**At session start:**
1. Open `ai/README.md` — the **index of indexes**: it names every index/log/projection
   (`RESUME.md`, `{{STATUS}}`, `ai/memory/INDEX.md`, `ai/{{SESSION_DIR}}/`, `ai/plans/`) and says
   which to read for your situation. Decide which index you need first; don't load them all.
2. Resuming a thread → `RESUME.md`. New/broad context → `{{STATUS}}` then skim
   `ai/memory/INDEX.md` (cheap TOC); open only the atomic files you need. Run a note's
   `**Verify:**` before trusting load-bearing claims.

**When you learn something durable / at session end:** follow `ai/CAPTURE.md`. Timeless facts
→ atomic file in `ai/memory/` (`gotcha_`/`schema_`/`decision_`/`pattern_`/`runbook_`) + a pointer
in `INDEX.md`; time-based narrative → `ai/{{SESSION_DIR}}/`; status changes → `{{STATUS}}`. Capture
decisions + the why. `/end-session` runs the capture protocol.
<!-- /knowledge-system -->
