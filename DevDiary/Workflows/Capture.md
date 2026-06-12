# Capture Workflow

Captures a development moment: screenshot + context + event metadata.

## Prerequisites

- A project name must be established (ask if not provided)
- At least one screenshot method must be available

## Steps

### 1. Identify Project and Description

From the user's request, extract:
- **Project name** (slug format: `godot-game`, `wisdom-pipeline`, etc.)
- **Description** of what happened ("vector field working", "collision bug", etc.)
- **Event type**: `milestone` | `failure` | `progress` | `decision`

If the user doesn't specify a project name, check:
1. `~/.claude/MEMORY/STATE/current-work.json` for active project context
2. Ask using AskUserQuestion

### 2. Create Content Directory

```bash
# Ensure directory exists
mkdir -p ~/.claude/MEMORY/CONTENT/{project}/{YYYY-MM-DD}/screenshots
mkdir -p ~/.claude/MEMORY/CONTENT/{project}/{YYYY-MM-DD}/posts
```

### 3. Capture Screenshot

**Choose the best available method based on project context:**

#### Option A: MCP Server (Preferred for Godot/connected apps)
If an MCP server is connected to the application:
- Use the MCP screenshot tool to capture the current state
- Save to: `~/.claude/MEMORY/CONTENT/{project}/{date}/screenshots/{NNN}_{slug}.png`

#### Option B: Browser Skill (Web applications)
```bash
bun ~/.claude/skills/Browser/Tools/Browse.ts screenshot ~/.claude/MEMORY/CONTENT/{project}/{date}/screenshots/{NNN}_{slug}.png
```

#### Option C: File Reference (Pipeline outputs)
If the user references an output file that already exists:
- Copy it to the screenshots directory
- Preserve original filename in the event metadata

#### Option D: Window Capture (Fallback)
Use PowerShell to capture a specific window:
```powershell
# PowerShell window capture (Windows)
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*{window_title}*" } | Select-Object -First 1
# ... capture logic
```

### 4. Gather Context Automatically

Pull from existing PAI systems (no manual input needed):

**Recent file changes** (since last capture or session start):
```bash
# Check git diff if in a git repo
git diff --stat HEAD~1
# Or use ActivityParser data from WORK/ directory
```

**Console/error output** (if available):
- Check active terminal output
- Pull from Browser skill diagnostics if web project

**Current ISC tasks** (if active):
- Read from TaskList for current session context

### 5. Write Event Entry

Append to `~/.claude/MEMORY/CONTENT/{project}/{date}/events.jsonl`:

```json
{
  "timestamp": "2026-02-08T15:23:00.000Z",
  "type": "milestone",
  "description": "Vector field shader working with particle system",
  "screenshot": "screenshots/003_vector-field-working.png",
  "files_changed": ["shaders/vector_field.gdshader", "scenes/main.tscn"],
  "errors": [],
  "context": "Spent 2 hours debugging shader uniforms. Key fix was...",
  "tags": ["shader", "particles", "breakthrough"]
}
```

### 6. Confirm to User

Output a summary:
```
DevDiary captured: {description}
  Screenshot: {path}
  Files changed: {count}
  Type: {milestone|failure|progress|decision}
  Event #{N} for {project} today
```

## Screenshot Naming Convention

Screenshots use sequential numbering with descriptive slugs:
- `001_initial-white-light.png`
- `002_vector-field-attempt.png`
- `003_vector-field-working.png`
- `004_collision-bug.png`

**Slugs are derived from the description**, not from URLs or file paths. Keep them short, lowercase, hyphenated.

## Event Types

| Type | When | Blog Narrative Value |
|------|------|---------------------|
| `milestone` | Something new works | "What I built" section |
| `failure` | Something broke | "What went wrong" section |
| `progress` | Incremental work | Timeline filler |
| `decision` | Chose approach A over B | "Why I chose..." section |

## Automatic Capture (Active)

### SessionEnd Auto-Diary (ACTIVE)

The `DevDiarySessionEnd.hook.ts` fires on every SessionEnd event and automatically:

1. Reads `MEMORY/STATE/current-work.json` (before SessionSummary clears it)
2. Reads the WORK/ directory for task items and metadata
3. Writes a `session-end` event to `MEMORY/CONTENT/{project}/{date}/events.jsonl`

**Hook order in settings.json:**
```
DevDiarySessionEnd → WorkCompletionLearning → SessionSummary
```
DevDiary runs FIRST because SessionSummary deletes `current-work.json`.

**Event format:**
```json
{
  "type": "session-end",
  "description": "Session ended. 3 work items: Fix HOME bug, Update Banner, ...",
  "tags": ["auto-capture", "session-end"],
  "duration_minutes": 45,
  "session_id": "abc123"
}
```

**What this means for synthesis:** When you run `synthesize`, session-end events provide the bookends. Combined with manual captures during the session, the Synthesize workflow gets a complete timeline: what was worked on, how long it took, and how it ended.

### Future Auto-Capture (Not Yet Implemented)
- **FailureCapture integration**: Auto-log failures with screenshots
- **Ratings 9-10**: Auto-capture euphoric moments
