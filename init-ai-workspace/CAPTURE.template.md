# How to Capture Knowledge (the protocol)

How an agent (or human) records what a session learned so it is not regenerated from
scratch next time. Read at session start; follow at session end (`/end-session` runs it).

Governing idea: **distill once, retrieve cheaply.** Re-deriving project facts each session
(re-reading code, re-searching, re-reasoning) is expensive *and non-deterministic*. A
distilled, provenance-tagged note is cheap and stable. The only thing that makes a note
net-negative is being **confidently wrong** (stale) — so every note carries its source and
a way to re-verify it.

---

## The two axes — where things go

> When copying this file, substitute `{{SESSION_DIR}}` with the project's session journal dir —
> `session` (singular, canonical default) or `sessions` (plural) — whichever already exists.

| Kind | Lives in | Nature |
|------|----------|--------|
| Time-based — what happened, decisions, pick-up state | `ai/{{SESSION_DIR}}/YYYY-MM-DD-topic.md` | Append-only journal. Frozen after. |
| Time-based — feature specs during a build | `ai/plans/*.md` | Frozen after the build. |
| Timeless — gotchas, constants, decisions, patterns, runbooks | `ai/memory/*.md` + `ai/memory/INDEX.md` | A wiki. Deduplicated, edited in place. |
| Current status | the project status doc (root) | Single source of truth. Updated every session. |

Rule of thumb: still true in six months → `ai/memory/`. "What we did on this date" → `ai/{{SESSION_DIR}}/`.

**Denormalize the timeless, query the live.** Cache slow-changing facts (enum values, IDs,
table names) as `schema_*` files — cheaper and more deterministic than a lookup every session.
Do NOT cache live state (counts, what's deployed) — query that at runtime; a cache goes stale.

---

## Atomic file format (`ai/memory/*.md`)

One concept per file. Filename = `TYPE_short-kebab-slug.md`, TYPE ∈
`gotcha | schema | decision | pattern | runbook`.

```markdown
---
title: Short human title
type: gotcha | schema | decision | pattern | runbook
updated: YYYY-MM-DD
source: <file:line | plan-N | session YYYY-MM-DD | external URL>
status: verified | unverified | stale
---

The distilled fact, stated plainly. Short.

**Verify:** the exact command / file:line / check that confirms this is still true.
```

`source` and `**Verify:**` are mandatory — the anti-rot mechanism. A note without provenance
is worth less than no note.

## Capturing "posted intent" (decisions + the why)

User directives, corrections, preferences, and **rejected options** are the highest-value
capture. Record each as a `decision_*.md`:

```markdown
**Decision (NAME, YYYY-MM-DD):** what was decided.
**Why:** the reasoning (a decision without its why gets re-litigated).
**Supersedes:** the prior belief/approach this overrides, if any.
```

---

## Write procedure (session end / when a learning lands)
1. **Check `ai/memory/INDEX.md` first** — if a note exists, EDIT it (don't duplicate).
2. If it contradicts an existing note, fix or mark the old one `status: stale` and say what misled you.
3. Write/edit the atomic file with full frontmatter + `**Verify:**`.
4. Add/refresh the one-line pointer in `INDEX.md`.
5. (Optional) propose it to a shared knowledge commons (e.g. `cq`) — `ai/memory/` is the durable source.

## Read procedure (session start)
1. Read `ai/memory/INDEX.md` (cheap TOC).
2. Open only the atomic files relevant to the task.
3. Before acting on a note that names a file/flag/value, run its `**Verify:**` check.

## What NOT to capture
- Anything derivable from code or `git log`.
- Anything that only matters to one conversation.
- Live/volatile metrics (status doc or runtime query instead).
- Secrets — point to where they live (SSM, key paths), never paste them.
