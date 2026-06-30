# HubSpot Quote Patterns

## Legacy vs Commerce Hub Quotes

HubSpot has two quoting systems. The classification is **account-level**, not per-quote:

| System | Requires | Template Type |
|--------|----------|---------------|
| **Legacy quotes** (Sales Hub) | Sales Hub Starter+ (pre-Sept 2025 accounts) | `QUOTE`, `PROPOSAL` |
| **Commerce Hub quotes** (modern) | Commerce Hub Professional/Enterprise | `CUSTOMIZABLE_QUOTE_TEMPLATE` |

**If your account uses Sales Hub (not Commerce Hub), ALL quotes are "Legacy."** This is expected — the "Legacy" label in the HubSpot UI is not an error or misconfiguration.

### Implications for API Quote Creation

- Quotes created via `hs.crm.quotes.basicApi.create()` without a `hs_template` association are Legacy quotes
- This is correct behavior for a Sales Hub account tier — Commerce Hub templates aren't available
- The v3 quotes API docs reference `CUSTOMIZABLE_QUOTE_TEMPLATE` but that requires Commerce Hub
- A clone function that creates quotes without a template produces Legacy quotes — this is fine for Sales Hub accounts

### If You Upgrade to Commerce Hub

If you ever migrate to Commerce Hub:
1. Legacy quote templates won't transfer — new ones must be created
2. API quote creation would need to associate a `CUSTOMIZABLE_QUOTE_TEMPLATE`
3. The clone function would need updating to reference a template ID

## Quote Status Lifecycle

```
DRAFT → PENDING_APPROVAL → APPROVED → (published/sent)
                         → REJECTED → DRAFT (re-edit)
         APPROVAL_NOT_NEEDED → (published/sent)
```

**Valid `hs_status` values:** `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `APPROVAL_NOT_NEEDED`, `REJECTED`

## Quote Locking (CRITICAL)

**HubSpot locks quotes in APPROVED or APPROVAL_NOT_NEEDED status.** When locked:
- `hs_locked` = `true`
- Cannot modify quote properties
- Cannot modify associated line items
- Cannot add/remove line item associations

### Unlock-Edit-Relock Pattern

To edit line items on a published quote, you MUST:

1. Read current quote status from DynamoDB
2. If status is APPROVED or APPROVAL_NOT_NEEDED, set `hs_status` to DRAFT
3. Perform the line item edit (create/update/delete)
4. Restore original `hs_status`

```javascript
const LOCKED_STATUSES = ["APPROVED", "APPROVAL_NOT_NEEDED"];

async function unlockQuoteIfNeeded(hs, quoteId) {
  const quoteMeta = await getItem(`QUOTE#${quoteId}`, "META");
  const status = quoteMeta?.status;
  if (status && LOCKED_STATUSES.includes(status)) {
    await hs.crm.quotes.basicApi.update(quoteId, {
      properties: { hs_status: "DRAFT" }
    });
    return status; // original status to restore
  }
  return null;
}

async function relockQuote(hs, quoteId, originalStatus) {
  if (originalStatus) {
    await hs.crm.quotes.basicApi.update(quoteId, {
      properties: { hs_status: originalStatus }
    });
  }
}
```

**Window of vulnerability:** ~100ms where quote appears as DRAFT in HubSpot. Acceptable for user-initiated operations.

## Line Item CRUD Patterns

### Create Line Item + Associate with Quote

```javascript
// Create line item with inline association to quote (type 68 = lineItem→quote)
// IMPORTANT: Type 67 is quote→lineItem (reverse!). Use 68 for lineItem→quote.
const liResp = await hs.crm.lineItems.basicApi.create({
  properties: { name, quantity: String(qty), price: String(price) },
  associations: [{
    to: { id: String(quoteId) },
    types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 68 }],
  }],
});
```

### Update Line Item

```javascript
await hs.crm.lineItems.basicApi.update(lineItemId, {
  properties: { name, quantity: String(qty), price: String(price) }
});
```

### Delete Line Item

```javascript
// HubSpot uses "archive" not "delete"
await hs.crm.lineItems.basicApi.archive(lineItemId);
```

**WARNING:** Deleting a quote in HubSpot also deletes all its associated line items. Archive quotes carefully.

## Line Item Ownership

- Line items belong to **one single parent object**
- If you need line items on BOTH a deal and a quote, create **separate line items** for each
- Association is one-to-one: a line item can only be associated with one quote OR one deal

## Quote Properties

| Property | HubSpot Field | Notes |
|----------|--------------|-------|
| Title | `hs_title` | Display name |
| Status | `hs_status` | See lifecycle above |
| Amount | `hs_quote_amount` | Auto-computed from line items when published |
| Expiration | `hs_expiration_date` | Format: `YYYY-MM-DD` |
| Locked | `hs_locked` | Boolean, set on publish |
| Template | `hs_quote_template_id` | Quote template ID |

## Line Item Properties

| Property | HubSpot Field | Notes |
|----------|--------------|-------|
| Name | `name` | Item name |
| Quantity | `quantity` | String number |
| Price | `price` | Unit price (string) |
| Amount | `amount` | Computed: qty * price |
| Description | `description` | Optional text |
| SKU | `hs_sku` | Product SKU |
| Product ID | `hs_product_id` | Links to product catalog |
| Billing Period | `hs_recurring_billing_period` | For subscriptions |
