# HubSpot Gotchas

Battle-tested lessons from building a CRM HubSpot integration.

## API Gotchas

### 1. Quote Locking Blocks Line Item Edits
**Problem:** HubSpot returns 400 error when you try to update/add/delete line items on an APPROVED or APPROVAL_NOT_NEEDED quote.
**Solution:** Temporarily set `hs_status: "DRAFT"`, perform edit, restore original status. See `QuotePatterns.md`.

### 2. Line Items Use String Values
**Problem:** `quantity` and `price` are strings in HubSpot, not numbers. Passing numeric values may cause errors or silent type coercion.
**Solution:** Always `String(quantity)` and `String(price)` when writing to HubSpot.

### 3. Delete = Archive
**Problem:** HubSpot doesn't have a true delete for most objects. The method is `basicApi.archive()`, not `basicApi.delete()`.
**Solution:** Use `hs.crm.lineItems.basicApi.archive(id)`.

### 4. Deleting a Quote Deletes Its Line Items
**Problem:** Archiving a quote cascades to all associated line items. They're gone.
**Solution:** Never archive quotes carelessly. If you need to remove a quote but keep line items, disassociate first.

### 5. hs_quote_amount Is Read-Only (Computed)
**Problem:** You can't set `hs_quote_amount` directly. HubSpot computes it from line items when the quote is published.
**Solution:** Don't include it in create/update calls. The amount in DynamoDB comes from the sync reading this computed value.

### 6. Association Changes Don't Update hs_lastmodifieddate
**Problem:** Adding/removing an association on an object doesn't always bump its `hs_lastmodifieddate`. This means incremental sync may miss newly-associated items.
**Solution:** Write directly to DynamoDB when creating associations in the CRM (don't rely on sync to catch up).

## DynamoDB Gotchas

### 7. Sync Overwrites CRM-Local Fields
**Problem:** The sync does a full `PutRequest` overwrite. Any field not in the HubSpot mapper (sendStatus, poNumber, renewalNote, etc.) gets wiped.
**Solution:** Currently mitigated by writing to DynamoDB immediately on CRM operations. Long-term fix: implement merge-on-sync or use separate SK for CRM-local fields.

### 8. Clone Orphans Deals from Companies
**Problem:** `cloneQuote()` creates a new deal but never writes a `COMPANY_DEAL` association to DynamoDB. The deal doesn't appear under any company until the next full sync.
**Solution:** Add `COMPANY#{companyId} / DEAL#{newDealId}` association write to the clone function.

### 9. Expiration Date Mismatch on Clone
**Problem:** Clone writes `now + 3 months` to HubSpot but `Dec 31` to DynamoDB. The two values disagree.
**Solution:** Use the same date for both, or derive expiration from deal close date.

## Frontend Gotchas

### 10. Three Amount Values Never Reconciled
**Problem:** `deal.amount`, `quote.amount`, and `sum(lineItem.qty * lineItem.price)` can all differ. The frontend computes from line items but falls back to quote.amount.
**Solution:** The quote health check system detects amount mismatches and shows an alert banner.

### 11. Null Quantity/Price Become 1/$0 on Clone
**Problem:** Clone does `li.quantity || "1"` and `li.price || "0"`. A line item with null quantity becomes 1, null price becomes $0. This silently changes the quote total.
**Solution:** The quote health check flags $0 line items. Long-term: validate before cloning.

## Quote System Gotchas

### 14. Quotes Show as "Legacy" in HubSpot — Expected
**Problem:** All quotes in HubSpot UI display a "Legacy" label, causing confusion about whether quotes were created incorrectly.
**Explanation:** This is account-level, not per-quote. If the account uses Sales Hub, not Commerce Hub, ALL quotes on Sales Hub accounts are classified as Legacy by HubSpot. This is not a bug or misconfiguration in the CRM.
**Solution:** No action needed. See `QuotePatterns.md` > "Legacy vs Commerce Hub Quotes" for full context.

### 15. Associations API Moved in v13 — No associationsApi on Object Types
**Problem:** In `@hubspot/api-client` v13+, `hs.crm.lineItems.associationsApi`, `hs.crm.quotes.associationsApi`, etc. do NOT exist. Object types only have `basicApi`, `batchApi`, `searchApi`. Code using `hs.crm.{object}.associationsApi.create()` fails with "Cannot read properties of undefined (reading 'create')".
**Solution:** Use the centralized v4 associations API instead:
```javascript
// ❌ WRONG (v13+)
await hs.crm.lineItems.associationsApi.create(liId, "quotes", quoteId, [...])
await hs.crm.quotes.associationsApi.create(quoteId, "deals", dealId, [...])

// ✅ CORRECT (v13+)
await hs.crm.associations.v4.basicApi.create("line_items", liId, "quotes", quoteId, [...])
await hs.crm.associations.v4.basicApi.create("quotes", quoteId, "deals", dealId, [...])
```
**Note:** The v4 API takes `fromObjectType` and `toObjectType` as strings (e.g., "line_items", "quotes", "deals"), not camelCase.

## Windows / Git Bash Gotchas

### 12. MSYS Path Conversion Breaks AWS CLI
**Problem:** Git Bash on Windows converts `/your-app/...` to `C:/your-app/...` which breaks AWS CLI ARN and SSM parameter paths.
**Solution:** Prefix ALL AWS CLI calls with `MSYS_NO_PATHCONV=1`.

### 13. SSM Parameter Path
**Problem:** Store the HubSpot token in an SSM parameter (e.g. `/your-app/hubspot-token`) and reference it consistently — a mismatched name (e.g. `hubspot-pat`) silently fails to resolve.
**Solution:** Pin the path in one place (e.g. a `HUBSPOT_TOKEN_SSM` env var) and reuse it everywhere.
