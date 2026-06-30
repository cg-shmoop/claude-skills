---
name: HubSpot
description: HubSpot CRM API knowledge base. USE WHEN hubspot api, hubspot integration, hubspot rate limits, hubspot quotes, hubspot line items, hubspot sync, hubspot association, quote locking, hs_status, hubspot CRUD.
---

# HubSpot API Knowledge Base

Battle-tested HubSpot CRM API patterns from building a CRM integration. Covers rate limits, quote lifecycle, line item CRUD, association management, and a HubSpot→DynamoDB sync architecture.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/skills/PAI/USER/SKILLCUSTOMIZATIONS/HubSpot/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Quick Reference

**Portal ID:** `YOUR_PORTAL_ID` (find it in HubSpot under Settings → Account Setup, or in any record URL)
**HubSpot Token:** store a Private App token in your secrets manager or an environment variable — never hardcode it
**Client Library:** `@hubspot/api-client` (TypeScript/Node.js)

**Rate Limits (Professional tier):**
- Burst: 190 requests / 10 seconds
- Daily: 625,000 requests / account
- Search API: 5 requests / second

**Key Association Type IDs:**
| Association | Type ID | Direction |
|-------------|---------|-----------|
| Quote to Deal | 64 | quote -> deal |
| Line Item to Quote | 68 | lineItem -> quote |
| Quote to Line Item | 67 | quote -> lineItem |
| Note to Deal | 214 | note -> deal |
| Contact to Company | 1 | contact -> company |
| Deal to Company | 5 | deal -> company |

## Documentation

- API limits, TOS, scopes: `ApiReference.md`
- Quote locking, status lifecycle, line item CRUD: `QuotePatterns.md`
- DynamoDB mirroring, sync architecture: `SyncArchitecture.md`
- Battle-tested gotchas: `Gotchas.md`

## Related Skills

- **HubSpotProjects** — CRUD on the Project custom object (`0-970`): create/update/close/comment/list. Uses a separate Private App token (`HUBSPOT_PROJECTS_TOKEN`). Invoke it directly for project-pipeline work instead of re-implementing here.
