# HubSpot Projects — Portal Reference

Portal-specific identifiers for the Project custom object. These are hardcoded into the Project custom object and do not change unless an admin edits the pipeline. **Fill in your own portal's values** — the pipeline and stage IDs below are placeholders.

## Object

| Property | Value |
|---|---|
| Portal ID | `YOUR_PORTAL_ID` (set `HUBSPOT_PORTAL_ID`) |
| Object Type ID | `0-970` (HubSpot standard Projects object — same across portals) |
| Object Name | `PROJECT` |
| Primary Display Property | `hs_name` |
| Required on Create | `hs_name`, `hs_pipeline_stage` |

## Pipeline

| Property | Value |
|---|---|
| Pipeline ID | `<your-project-pipeline-id>` (set `HUBSPOT_PROJECT_PIPELINE_ID`) |
| Pipeline Name | Project Pipeline |

## Stages

Stage IDs are portal-specific UUIDs. Fill these into the `STAGES` dict in `tools/hsproj.py`. Discover them from the property metadata:
`GET /crm/v3/properties/0-970/hs_pipeline_stage` (each option's `value` is the stage ID).

| Name | Stage ID |
|---|---|
| planning | `<planning-stage-id>` |
| execution | `<execution-stage-id>` |
| review | `<review-stage-id>` |
| completed | `<completed-stage-id>` |
| cancelled | `<cancelled-stage-id>` |
| on_hold | `<on_hold-stage-id>` |

A second pipeline (e.g. a Customer Onboarding pipeline) may also exist on this object — it is not used by the default `create` path. Query via the `stages` subcommand or property metadata if needed.

## Status (`hs_status`)

| Value | Label |
|---|---|
| `on_track` | On Track |
| `delayed` | Delayed |
| `blocked` | Blocked |
| `completed` | Completed |
| `on_hold` | On-Hold |
| `at_risk` | At-Risk |

## Portal Workflows (important!)

A HubSpot workflow may automatically move a project from **Planning → Execution** when status and dates are populated. If you create a project in Planning and immediately set `hs_status=on_track` + dates, expect the stage to flip. Accept this, or set stage last. (This depends on how workflows are configured in your portal.)

## Owners

Owners are portal-specific. Don't hardcode them — list them at runtime:

```bash
python hsproj.py owners               # all owners
python hsproj.py owners --search jane # filter by name or email
```

The CLI resolves an `--owner you@example.com` to its owner ID via `/crm/v3/owners?email=`.

> Note: HubSpot stamps `hs_created_by_user_id` on records. Pre-existing projects may show a historical creator-of-record (whoever's userId is on older records) rather than the API user — that's expected, not a bug.

## Date Format

Properties `hs_start_date`, `hs_target_due_date`, `hs_close_date` are `type=datetime fieldType=date`. HubSpot accepts **millisecond epoch** for write, and returns ISO-8601 UTC on read. The CLI handles the conversion from `YYYY-MM-DD` on input.

## API Endpoints Used

| Op | Endpoint |
|---|---|
| Schema | `GET /crm/v3/schemas/0-970` |
| Property meta | `GET /crm/v3/properties/0-970/{name}` |
| List | `GET /crm/v3/objects/0-970?properties=...&limit=...` |
| Get | `GET /crm/v3/objects/0-970/{id}?properties=...` |
| Create | `POST /crm/v3/objects/0-970` |
| Update | `PATCH /crm/v3/objects/0-970/{id}` |
| Owners | `GET /crm/v3/owners/?email=...` or `?limit=100` |
| Note create | `POST /crm/v3/objects/notes` |
| Associate note | `PUT /crm/v3/objects/notes/{noteId}/associations/0-970/{projectId}/note_to_project` |

The pipelines endpoint (`/crm/v3/pipelines/0-970`) may be **scope-locked** for this object — use property metadata (`hs_pipeline_stage` options) instead.
