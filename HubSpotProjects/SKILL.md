---
name: HubSpotProjects
description: Create, update, close, comment on, and list HubSpot Project (custom object 0-970) records in your portal. USE WHEN hubspot project, create project, update project, close project, project status, project owner, project stage, comment on project, hs_project, project pipeline, LTI project, onboarding project.
---

# HubSpot Projects CLI

Fast, scriptable CRUD on the HubSpot **Project** custom object (type `0-970`). Designed to be invoked from any working directory — does not depend on any particular codebase.

## When to use

Trigger this skill when the user asks to:
- Create a new project record ("make a hubspot project for X")
- Update project status, dates, owner, stage, or name
- Close a project (sets status=completed, stage=Completed, close date)
- Cancel a project (stage=Cancelled)
- Add a comment (Note engagement) to a project
- List / look up projects

## Portal configuration

The Project object's pipeline and stage IDs are **portal-specific** — you must point the CLI at your own portal before the stage-aware commands work:

- `HUBSPOT_PORTAL_ID` — your portal ID (used to build record URLs)
- `HUBSPOT_PROJECT_PIPELINE_ID` — your Project pipeline UUID
- The `STAGES` dict at the top of `tools/hsproj.py` — fill in your portal's stage UUIDs (discover them via the `hs_pipeline_stage` property metadata: `GET /crm/v3/properties/0-970/hs_pipeline_stage`)

See `REFERENCE.md` for where each of these lives and how to find them.

## Token

The CLI reads the HubSpot **Private App** access token in this order:
1. Environment variable `HUBSPOT_PROJECTS_TOKEN`
2. File `~/.hubspot_projects_token` (plain-text, token on a single line)

Token format must be `pat-na1-...`. If the CLI reports 401, regenerate in Settings → Integrations → Private Apps. If 403 with `MISSING_SCOPES`, add the listed scope and regenerate.

Required scopes on the Private App:
- `crm.schemas.custom.read`
- `crm.objects.custom.read`
- `crm.objects.custom.write`
- `crm.objects.owners.read`
- `crm.objects.notes.read` + `crm.objects.notes.write` (for `comment` subcommand only)

## CLI reference

Run from anywhere:
```bash
python "~/.claude/skills/HubSpotProjects/tools/hsproj.py" <command> [args]
```

### Commands

| Command | Purpose |
|---|---|
| `get <id>` | Fetch a project and print its key fields |
| `list [--limit N] [--owner EMAIL] [--stage NAME]` | List projects (optionally filtered) |
| `create --name "..." [--owner EMAIL] [--stage NAME] [--status NAME] [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--description "..."]` | Create a project |
| `update <id> [same flags as create]` | Partial update |
| `close <id> [--cancel]` | Set status=completed + stage=Completed + close date (or Cancelled with `--cancel`) |
| `comment <id> "text" [--html] [--from-file FILE]` | Create a Note engagement associated to the project (plain text auto-formatted to tight HTML — see Note formatting below) |
| `owners [--search Q]` | List all owners (or grep by name/email) |
| `stages` | Print pipeline + stage IDs and status options |

Names accepted for `--stage`: `planning`, `execution`, `review`, `completed`, `cancelled`, `on_hold`.
Names accepted for `--status`: `on_track`, `delayed`, `blocked`, `completed`, `on_hold`, `at_risk`.
Owner resolution: email → ownerId lookup via `/crm/v3/owners?email=`.

### Note formatting (`comment` subcommand)

HubSpot stores `hs_note_body` as HTML. Plain-text newlines collapse on render, and whitespace between block tags becomes visible rendered spacing — so the CLI auto-formats plain text into tight HTML that renders cleanly in the timeline:

- Blank lines split paragraphs → `<p>...</p>`
- Consecutive lines beginning with `- ` or `* ` become a single `<ul><li>...</li></ul>`
- Within a paragraph, single newlines become `<br>`
- Stray `&`, `<`, `>` in text are escaped

Pass `--html` if you are supplying hand-authored HTML. The CLI will still collapse inter-tag whitespace for you (HubSpot renders that whitespace as extra vertical gaps).

For long notes, use `--from-file path/to/note.txt` to bypass shell-quoting headaches.

### Output

Default is human-readable. Append `--json` for machine-readable output.

## Examples

```bash
# Create
python hsproj.py create --name "New Customer Onboarding" \
  --owner you@example.com --status on_track --start 2026-04-16 --end 2026-04-24

# Update status
python hsproj.py update 549855272613 --status delayed

# Close
python hsproj.py close 549855272613

# Comment (plain text — auto-wrapped to tight HTML)
python hsproj.py comment 549855272613 "Kickoff call scheduled for Thursday"

# Comment with structure (blank lines -> paragraphs, `- ` lines -> bullets)
python hsproj.py comment 549855272613 "Daily update

Progress:
- Phase 1 done
- Phase 2 in review

Next: stage deploy"

# Comment from file (avoids shell-quoting for long notes)
python hsproj.py comment 549855272613 --from-file ./note.txt

# Comment with raw HTML (skip auto-formatting, but inter-tag whitespace is still collapsed)
python hsproj.py comment 549855272613 --html "<p><b>Heading</b></p><p>Body</p>"

# Find
python hsproj.py list --owner you@example.com
```

## Invocation from Claude

When invoking this skill, execute `hsproj.py` via Bash. Do **not** re-implement the HubSpot API calls in other skills — use this CLI. If a command fails with a scope error, surface the required scope to the user rather than silently degrading.

See `REFERENCE.md` for the portal-specific IDs you need to fill in (pipeline UUID, stage UUIDs, schema cheatsheet).
