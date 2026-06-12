# DevDiaryCapture.ts

Development diary event capture CLI tool.

## Commands

| Command | Description |
|---------|-------------|
| `capture <project> <desc>` | Capture a development event |
| `list <project>` | List events for a project |
| `status [project]` | Show diary status overview |
| `init <project>` | Initialize a new project diary |

## Capture Options

| Flag | Description | Default |
|------|-------------|---------|
| `--type <type>` | Event type: milestone, failure, progress, decision | progress |
| `--screenshot <path>` | Screenshot file to copy into diary | none |
| `--tag <tag>` | Tag (repeatable) | none |
| `--context "<text>"` | Additional context text | none |
| `--date <YYYY-MM-DD>` | Date override | today |

## Event Types

| Type | Icon | Use For |
|------|------|---------|
| `milestone` | ★ | Something new works |
| `failure` | ✗ | Something broke |
| `progress` | → | Incremental work |
| `decision` | ◆ | Chose approach A over B |

## Storage

Events stored in `~/.claude/MEMORY/CONTENT/{project}/{date}/events.jsonl`
Screenshots copied to `~/.claude/MEMORY/CONTENT/{project}/{date}/screenshots/`

## Examples

```bash
# Initialize a project
bun DevDiaryCapture.ts init godot-game

# Capture with screenshot
bun DevDiaryCapture.ts capture godot-game "Vector field working" \
  --type milestone \
  --screenshot ./screen.png \
  --tag shader --tag particles

# List today's events
bun DevDiaryCapture.ts list godot-game

# Check all projects
bun DevDiaryCapture.ts status
```
