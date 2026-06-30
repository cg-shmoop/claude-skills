# HubSpot API Reference

## Rate Limits

| Tier | Burst (per 10s) | Daily (per account) |
|------|-----------------|---------------------|
| Free/Starter | 100 | 250,000 |
| Professional | 190 | 625,000 |
| Enterprise | 190 | 1,000,000 |
| + API Limit Pack | 250 | +1,000,000 |

**Search API:** 5 requests/second, max 200 records per response.

**Example — a Professional-tier account** = 190 burst, 625K daily.

User-initiated CRM operations (1-3 calls per action) are negligible against these limits. Bulk sync operations should include rate-limit delays (500ms between batches).

## Required Scopes

| Scope | Operations |
|-------|-----------|
| `crm.objects.line_items.read` | Read line items |
| `crm.objects.line_items.write` | Create, update, delete line items |
| `crm.objects.quotes.read` | Read quotes |
| `crm.objects.quotes.write` | Create, update quotes, change hs_status |
| `crm.objects.deals.read` | Read deals |
| `crm.objects.deals.write` | Create, update deals |
| `crm.objects.contacts.read` | Read contacts |
| `crm.objects.contacts.write` | Create contacts |

## Terms of Service Compliance

Line item CRUD (create, read, update, delete) is a **standard supported API use case**. No special permissions or approval needed beyond the scopes above.

Key TOS points:
- All CRM object types support programmatic CRUD via `/crm/v3/objects/{objectType}`
- Associations managed separately via Associations API
- No restrictions on automating quote/deal/line-item workflows
- HubSpot strongly encourages building integrations via their API

## Key Endpoints

```
# Line Items
GET    /crm/v3/objects/line_items/{id}
POST   /crm/v3/objects/line_items
PATCH  /crm/v3/objects/line_items/{id}
DELETE /crm/v3/objects/line_items/{id}

# Quotes
GET    /crm/v3/objects/quotes/{id}
POST   /crm/v3/objects/quotes
PATCH  /crm/v3/objects/quotes/{id}

# Deals
GET    /crm/v3/objects/deals/{id}
POST   /crm/v3/objects/deals
PATCH  /crm/v3/objects/deals/{id}

# Associations
PUT    /crm/v4/objects/{fromType}/{fromId}/associations/{toType}/{toId}
```

## @hubspot/api-client Usage

```javascript
import { Client as HubSpotClient } from "@hubspot/api-client";

const hs = new HubSpotClient({ accessToken: token });

// Line item CRUD
await hs.crm.lineItems.basicApi.create({ properties: { name, quantity, price } });
await hs.crm.lineItems.basicApi.update(id, { properties: { name, quantity, price } });
await hs.crm.lineItems.basicApi.archive(id);  // "delete" = archive in HubSpot

// Associations
await hs.crm.lineItems.associationsApi.create(
  lineItemId, "quotes", quoteId,
  [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 67 }]
);

// Quote status
await hs.crm.quotes.basicApi.update(quoteId, {
  properties: { hs_status: "DRAFT" }
});
```
