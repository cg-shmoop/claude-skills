# Review Workflow

Shows the current state of diary captures for a project.

## Steps

### 1. Identify Project

If no project specified, list all projects with content:
```bash
ls ~/.claude/MEMORY/CONTENT/
```

### 2. Show Capture Summary

For the selected project, display:

```
DevDiary: {project}
══════════════════════════════

{date_1}:
  Events: {count}
  Screenshots: {count}
  Types: {milestone: N, failure: N, progress: N}
  Draft posts: {count}
  Published: {yes/no}

{date_2}:
  ...

──────────────────────────────
Total: {total_events} events, {total_screenshots} screenshots
Posts: {draft_count} drafts, {published_count} published
```

### 3. Show Recent Events (Optional)

If user asks for detail, show the last 5-10 events:

```
Recent captures:
  1. [milestone] 15:23 - Vector field working (003_vector-field-working.png)
  2. [failure]   14:50 - Collision bug on floor tiles (002_collision-bug.png)
  3. [progress]  13:15 - Added particle system (001_particles-initial.png)
```

### 4. Suggest Next Action

Based on the state:
- **Enough captures, no draft** → "Ready to synthesize? Say 'synthesize diary'"
- **Draft exists, not published** → "Draft ready for review. Say 'publish diary'"
- **No captures today** → "Start capturing! Say 'capture this' during development"
