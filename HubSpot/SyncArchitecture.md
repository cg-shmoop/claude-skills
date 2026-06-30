# HubSpot Sync Architecture

## Overview

This CRM integration uses a one-way HubSpot-to-DynamoDB sync with selective CRM-to-HubSpot writes. HubSpot is the system of record for most data; DynamoDB is the read-optimized cache.

## Object Types Synced

The sync lambda processes these types in order:
`companies → contacts → deals → quotes → line_items`

Each type runs through `syncObjectType()` which:
1. Fetches from HubSpot CRM Search API (incremental via `hs_lastmodifieddate >= checkpoint`)
2. Maps via `mapCompany()`, `mapDeal()`, `mapQuote()`, `mapLineItem()` etc.
3. Writes to DynamoDB via `BatchWriteCommand` (full PutRequest overwrite)
4. Processes associations and writes association records

## DynamoDB Single-Table Design

| Entity | PK | SK | Notes |
|--------|----|----|-------|
| Company | `COMPANY#{id}` | `META` | Core company fields |
| Contact | `CONTACT#{id}` | `META` | Core contact fields |
| Deal | `DEAL#{id}` | `META` | Core deal fields |
| Quote | `QUOTE#{id}` | `META` | Core quote fields |
| Line Item | `QUOTE#{quoteId}` | `LINEITEM#{liId}` | Nested under parent quote |
| Company-Deal | `COMPANY#{id}` | `DEAL#{dealId}` | Association pointer |
| Deal-Quote | `DEAL#{dealId}` | `QUOTE#{quoteId}` | Association pointer |
| Activity | `{entityType}#{id}` | `ACTIVITY#{ts}#{uuid}` | Per-entity log |
| Activity (global) | `ACTIVITY_LOG` | `{ts}#{uuid}` | Global feed |

## Line Item Sync Details

Line items are synced as a **separate object type**, not embedded in quotes.

**Properties fetched from HubSpot:**
`name, quantity, price, amount, description, hs_product_id, hs_sku, hs_recurring_billing_period, hs_lastmodifieddate, createdate`

**PK assignment is dynamic** based on quote associations:
- If associated with a quote: `PK: QUOTE#{quoteId}, SK: LINEITEM#{lineItemId}`
- If orphaned (no quote): `PK: LINEITEM#{lineItemId}, SK: META`

## Association Type IDs

| Association | Type ID | Category |
|-------------|---------|----------|
| Quote → Deal | 64 | HUBSPOT_DEFINED |
| Line Item → Quote | 67 | HUBSPOT_DEFINED |
| Note → Deal | 214 | HUBSPOT_DEFINED |
| Contact → Company | 1 | HUBSPOT_DEFINED |
| Deal → Company | 5 | HUBSPOT_DEFINED |

## CRM-Local Fields (NOT in HubSpot)

These fields are written by CRM operations but **do not exist as HubSpot properties:**

| Field | Entity | Written By |
|-------|--------|-----------|
| `sendStatus` | Quote | `updateSendStatus()` |
| `responseNote` | Quote | `updateSendStatus()` |
| `poNumber` | Quote | `acceptPublicQuote()` |
| `poAcceptedAt` | Quote | `acceptPublicQuote()` |
| `poApEmail` | Quote | `acceptPublicQuote()` |
| `clonedFrom` | Quote | `cloneQuote()` |
| `renewalNote` | Deal | `saveDealNote()` |
| `accountClassificationOverride` | Company | `updateCompanyClassification()` |
| `lastModifiedSource` | All | Set to "CRM" on CRM writes |

## Known Sync Issue: Overwrite Problem

**The sync uses `BatchWriteCommand` with `PutRequest` (full overwrite).** This means:

- CRM-local fields listed above are **wiped on every sync cycle**
- The sync does not merge — it replaces the entire DynamoDB record
- `lastModifiedSource: "CRM"` is overwritten with `"HUBSPOT"`

### Mitigation Options (Not Yet Implemented)

1. **Merge-on-sync:** Read existing record before write, preserve CRM-local fields
2. **Separate SK:** Store CRM-local fields under a different SK (e.g., `CRM_META`) that sync doesn't touch
3. **HubSpot custom properties:** Create HubSpot properties for fields like `sendStatus` and `poNumber` so they survive sync

## Incremental Sync Gap

When line items are created by the clone operation and then associated with a quote, the quote's `hs_lastmodifieddate` may not advance (associations don't always touch the parent). This means:
- Newly-cloned line items could be missed by incremental sync
- The clone writes directly to DynamoDB to mitigate this
- A full sync will always catch up

## Clone Architecture Gap

The `cloneQuote` function:
1. Creates a new deal in HubSpot
2. Creates a new quote in HubSpot
3. Creates new line items and associates them
4. Writes all to DynamoDB immediately

**Missing:** No `COMPANY_DEAL` association is written for the new deal. The cloned deal is orphaned from any company until the next full HubSpot sync picks up the association.
