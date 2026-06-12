---
name: init-ai-workspace
description: >
  Initialize or upgrade any project into the standard in-repo knowledge structure: a
  visible ai/ folder whose README is an index-of-indexes (points at RESUME, STATUS,
  memory wiki + INDEX, session, plans), a root RESUME.md packet, a root README
  "Knowledge & status" front-door section, and a root CLAUDE.md knowledge-system section
  that routes the agent to the index of indexes at session start. Idempotent and
  non-destructive — detects current state, never overwrites existing content, appends
  marker-gated sections to existing README/CLAUDE.md, and offers an approval-gated
  migration of a hidden .ai/ folder to a visible ai/ folder (git mv + safe reference fixups).
  USE WHEN: "initialize ai workspace", "scaffold ai folder", "set up project knowledge",
  "migrate .ai to ai", "/init-ai-workspace", or onboarding a project to the knowledge system.
  (Complements the built-in /init, which only generates CLAUDE.md from code.)
---

# init-ai-workspace — standardize a project's knowledge structure

Gives a project the in-repo, visible, git-tracked knowledge system: timeless learnings in
a wiki, time-based work in a journal, and capture rules the agent reads at session start —
so knowledge is distilled once and retrieved cheaply, not regenerated every session.

## Governing principles (do not violate)
1. **Idempotent** — safe to run repeatedly. Re-running changes nothing already correct.
2. **Non-destructive** — NEVER overwrite an existing file's content. Create only what's missing;
   for CLAUDE.md, *append* a marked section. When unsure, show the diff and ask.
3. **Approval-gated migration** — the `.ai/ → ai/` rename touches many files; show the plan and
   get a yes before running it.
4. **History-preserving** — use `git mv` so renames keep blame/history.

Run the phases in order. Use `pwd`/repo root as the target unless the user names one.

---

## Phase 0 — Detect current state (report before acting)
Check and report:
- Folder: does `.ai/` exist? `ai/`? both? neither?
- `git rev-parse --is-inside-work-tree` — is it a git repo? (affects rename method)
- Root `CLAUDE.md` — exists? does it already contain the marker `<!-- knowledge-system -->`?
- Root `README.md` — exists? does it already contain the marker `<!-- knowledge-system -->`?
- Root `RESUME.md` — exists? (created here as a stub if absent; `/end-session` overwrites it.)
- Project **status doc** — `STATUS.md` at root? a different name/path? Note it; it's `{{STATUS}}`
  in the templates (default `STATUS.md`). If none exists, the index will still point at the
  intended path — flag that the project should start one.
- `ai/memory/INDEX.md` — exists? `ai/CAPTURE.md`? `ai/README.md`? If `ai/README.md` exists but is
  an older "folder map" (no index-of-indexes / no situation read-order table), offer to upgrade it.
- Session journal dir — does `ai/session/` (singular) or `ai/sessions/` (plural) already exist?
  Note which spelling is in use; you will **reuse it**, not create the other variant.
Summarize what will be created/migrated/skipped, then proceed.

---

## Phase 1 — Migrate `.ai/` → `ai/` (only if `.ai/` exists; approval-gated)
Skip entirely if there's already an `ai/` and no `.ai/`. If `.ai/` exists:

1. **Collision safety check** — never rewrite a `.ai` domain URL (e.g. `mem0.ai/`):
   `grep -rn '[A-Za-z0-9]\.ai/' --include='*.md' --include='*.ts' --include='*.mjs' --include='*.json' --include='*.sh' --include='*.html' --exclude-dir=node_modules --exclude-dir=.git .`
   If any hits are real domains, exclude those files/lines from the sed below (do them by hand).
2. **Check for untracked files** under `.ai/`: `git status --porcelain .ai/ | grep '^??'`.
   `git mv` only moves tracked files — move any untracked stragglers with plain `mv` afterward.
3. **Rename (git repo):** `git mv .ai ai` — then move untracked leftovers: `[ -d .ai ] && mv .ai/* ai/ 2>/dev/null; [ -d .ai ] && rmdir .ai`.
   **Non-git:** plain `mv .ai ai`.
4. **Update forward-slash references** across text files (safe after the collision check):
   `grep -rlZ --include='*.md' --include='*.ts' --include='*.mjs' --include='*.json' --include='*.sh' --include='*.html' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist '\.ai/' . | xargs -0 -r sed -i 's#\.ai/#ai/#g'`
5. **Update Windows backslash references** (`...\.ai\...`) — sed backslash escaping is unreliable;
   find them with `grep -rn '\.ai\\' --include='*.md' .` and fix each with an exact Edit
   (`\.ai\` → `\ai\`). Don't forget any external memory/notes index that names the path.
6. **Verify zero stragglers:** `git grep -n '\.ai[/\\]' -- ':!node_modules'` must return nothing.

---

## Phase 2 — Scaffold the `ai/` structure (create only what's missing)
Create dirs if absent: `ai/`, `ai/memory/`, `ai/plans/`, and the session journal dir.
**Session dir spelling — reuse, don't duplicate:** both `ai/session/` (singular, canonical
default) and `ai/sessions/` (plural) are valid. If either already exists, use that one and
do NOT create the other. Only when neither exists, create `ai/session/`. Whichever spelling
is in play, use it consistently in the README, CAPTURE, and CLAUDE.md text you write below
(`{{SESSION_DIR}}` in the templates = the chosen dir name).
Create these files ONLY if they don't already exist (replace `{{PROJECT}}` with the repo/dir name).
If a file exists, leave it untouched and note it as "kept".

**`ai/README.md`** — the **index of indexes** (the entry point that routes to every other
index). Copy this skill's `README.template.md` and substitute `{{PROJECT}}` / `{{SESSION_DIR}}`
/ `{{STATUS}}` (the status-doc path, default `STATUS.md`). It points *up* at the root-level
`RESUME.md` and `{{STATUS}}` via `../`, and *down* at `memory/INDEX.md`, the session log, and
`plans/`, with a "which index do I open?" read-order table.
**Upgrade case:** if `ai/README.md` already exists as an older flat "folder map" (no
index-of-indexes framing, no situation read-order table), show the diff and offer to replace
it with the template — this is the one create-only file worth upgrading in place (approval-gated).

**`ai/CAPTURE.md`** — copy the canonical protocol (the version in this skill's companion
`CAPTURE.template.md` if present, else write the protocol covering: timeless-vs-time-based
split; atomic file format with `type`, `updated`, `source`, `status` frontmatter + a mandatory
`**Verify:**` line; the `decision_` "posted intent" format with **Why:**/**Supersedes:**;
denormalize-the-timeless / query-the-live; write-procedure = check INDEX first, edit-don't-dupe,
flag stale, add INDEX pointer; read-procedure = read INDEX at start, verify-on-use; and what
NOT to capture — anything derivable from code/git, volatile metrics, or secrets).

**`ai/memory/INDEX.md`** — the wiki TOC:
```markdown
# Memory Index (timeless wiki TOC)

Scan first; open only the files you need. One line per note. Add a pointer here whenever
you create a file in `ai/memory/`. Format/rules: [`../CAPTURE.md`](../CAPTURE.md).

## Gotchas (operational traps)
## Schema / Constants (stable values — cache, don't re-look-up)
## Decisions (posted intent + the why)
## Patterns (recurring engineering shapes)
## Runbooks (exact command sequences)
```

**`RESUME.md`** (repo **root**, not `ai/`) — the T0 resumption packet. Create a stub ONLY if
absent (if it exists, leave it — `/end-session` owns this file): copy this skill's
`RESUME.template.md` and substitute `{{PROJECT}}` / `{{STATUS}}`. This keeps the index of
indexes' `../RESUME.md` link from dangling on a fresh workspace; `/end-session` Phase 9
overwrites the stub with real active-thread state.

---

## Phase 3 — Wire the root files (create, or marker-gated append — never overwrite)

Two root-level files orient the two audiences: `CLAUDE.md` routes the **agent**, `README.md`
routes the **human / GitHub view**. Both carry the same `<!-- knowledge-system -->` marker so
re-runs are idempotent.

### 3a — `README.md` (the human front door)
- **No root `README.md`:** create one with the section from `root-readme-section.template.md`
  (substitute `{{STATUS}}`), under an `# {{PROJECT}}` title.
- **Exists, already has `<!-- knowledge-system -->`:** skip.
- **Exists, missing the marker:** *append* the `root-readme-section.template.md` block near the
  top (after the intro, before deep architecture) — do not touch existing content.

### 3b — `CLAUDE.md` (the agent router)
- **No root `CLAUDE.md`:** create it with the section from `claude-md-section.template.md`.
- **Exists, already has `<!-- knowledge-system -->`:** skip (idempotent). If the existing marked
  section still says "skim `ai/memory/INDEX.md`" first (the pre-index-of-indexes wording), offer
  to replace the marked block with the current template (which routes to `ai/README.md` first).
- **Exists, missing the marker:** *append* the section (do not touch existing content).

Use this skill's **`claude-md-section.template.md`** (substitute `{{SESSION_DIR}}` / `{{STATUS}}`).
It routes the agent to `ai/README.md` (the index of indexes) **first**, then to RESUME / status /
`memory/INDEX.md` by situation — matching the index the workspace now exposes.

---

## Phase 4 — Verify & report
- `git grep -n '\.ai[/\\]'` returns nothing (if a migration ran).
- **Index of indexes resolves:** every link in `ai/README.md` points at a real path —
  `../RESUME.md`, `../{{STATUS}}`, `memory/INDEX.md`, `{{SESSION_DIR}}/`, `plans/`, `CAPTURE.md`.
  (If `{{STATUS}}` doesn't exist yet, flag it: the project should start its status doc.)
- **Both front doors wired:** root `README.md` and `CLAUDE.md` each contain one
  `<!-- knowledge-system -->` block pointing at `ai/README.md`.
- The structure exists; list what was **created**, **migrated**, **kept** (skipped) —
  including `RESUME.md` (stub vs kept) and the root-`README.md` section (created vs appended vs kept).
- **Durability reminder:** new files are untracked until committed — *untracked = lost on a
  fresh clone.* Recommend (and offer) a focused commit of the `ai/` scaffolding, honoring the
  repo's commit rules. Do not commit without the user's go-ahead.

## Anti-patterns
- Overwriting an existing `CAPTURE.md`/`CLAUDE.md`/memory file. (Create-only; append for CLAUDE.md.)
- Creating `ai/session/` next to an existing `ai/sessions/` (or vice-versa) — fragments the journal.
  Detect the existing spelling and reuse it; only default to `session/` when neither exists.
- Running the rename sed before the domain-collision check.
- Blanket-sed'ing backslash Windows paths (escaping breaks) — Edit those by hand.
- Declaring done without `git grep` proving zero `.ai/` stragglers.
- Committing the rename tangled with unrelated working-tree changes without flagging it.
