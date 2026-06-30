# Claude Code Skills

A collection of custom [Claude Code](https://claude.com/claude-code) skills I built for my own daily use. Each directory is a self-contained skill: drop it into `~/.claude/skills/` and Claude Code picks it up.

## Install

```bash
git clone https://github.com/cg-shmoop/claude-skills.git
cp -r claude-skills/<SkillName> ~/.claude/skills/
```

Skills with a `package.json` need their dependencies installed once:

```bash
cd ~/.claude/skills/<SkillName> && npm install   # or bun install
```

## Skills

### Accessibility testing

- **AccessibilityScan** — Automated WCAG 2.2 AA scanning with axe-core + Playwright. Scans single pages or batches of 130+ URLs, generates JSON/HTML reports grouped by impact level, supports authenticated sessions via saved browser state.
- **BrailleTest** — Navigates websites the way a blind JAWS user with a 40-cell refreshable braille display would, catching failures automated scanners can't (reading order, focus traps, unlabeled context). Simulates JAWS navigation commands against a real browser.
- **SiteCrawler** — Playwright-based internal-link crawler that discovers user-facing pages and emits a deduplicated URL list, designed to feed AccessibilityScan's `--batch` mode.

These three compose into a pipeline: crawl a site → batch-scan every page → braille-test the critical flows.

### Knowledge & session management

- **init-ai-workspace** — Scaffolds any project with an in-repo `ai/` knowledge structure: an index-of-indexes README, a RESUME.md pick-up packet, a memory wiki, and CLAUDE.md routing so agents front-load context at session start. Idempotent and non-destructive.
- **end-session** — Structured session close-out: reconstructs what happened, writes pick-up state, runs a "6-month cold-read" test on the notes, audits whether work is actually committed, and asks the human the things only they know. Exists because session summaries routinely lose the *operational* details a returning agent needs.

### Content & media

- **DevDiary** — Captures screenshots, file changes, errors, and learnings during dev sessions and synthesizes them into narrative blog posts.
- **EnrichPrompts** — Fills structural image-prompt templates with cinematographically-informed visual descriptions (camera, light, motion) for an image/video generation pipeline. Built for my story-production vault but the pattern generalizes.
- **FreesoundSearch** — Searches the Freesound.org API for sound effects matching SFX cue descriptions and downloads HQ previews for review. Needs a free `FREESOUND_API_KEY`.

### Google Workspace

- **GoogleDocs** — `gdoc.py`/`gsheet.py`: OAuth-authenticated CLIs that fill the gap left by the Google Drive MCP, which can read/copy/create files but cannot edit Doc content. Append sections, find/replace, delete-and-redo sections, surgical Sheet cell writes.

### CRM

- **HubSpot** — Battle-tested HubSpot CRM API knowledge base: rate limits, the quote status lifecycle and the unlock-edit-relock pattern for locked quotes, line-item CRUD, association type IDs, a HubSpot→DynamoDB sync architecture, and a long list of hard-won gotchas (v13 associations API move, delete-is-archive, computed quote amounts, MSYS path conversion). Pure reference — no code to run.
- **HubSpotProjects** — `hsproj.py`: a zero-dependency Python CLI for the HubSpot Project custom object (`0-970`). Create, update, close/cancel, comment (plain text auto-formatted into tight HubSpot-friendly HTML), and list/filter projects by owner or stage. Portal ID, pipeline UUID, and stage UUIDs are configurable for your own portal.

## Notes

- Example URLs in docs use `example.com` placeholders — point the tools at your own sites.
- The HubSpot skills ship with placeholders (`YOUR_PORTAL_ID`, `<your-project-pipeline-id>`, `<…-stage-id>`) — set `HUBSPOT_PORTAL_ID` / `HUBSPOT_PROJECT_PIPELINE_ID` and fill in your portal's stage UUIDs (see `HubSpotProjects/REFERENCE.md`). The token comes from `HUBSPOT_PROJECTS_TOKEN` or `~/.hubspot_projects_token` — never committed.
- `BrailleTest/Tools/credentials.ts` is a stub: add your own test accounts (never production credentials).
- Skills reference an optional customization directory (`PAI/USER/SKILLCUSTOMIZATIONS/`) from [danielmiessler/PAI](https://github.com/danielmiessler/PAI); without PAI installed they just use their defaults.

## License

MIT
