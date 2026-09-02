# Stripe catalog and credit authority

## Financial invariant

The browser never determines a chargeable amount. Owners enter a proposed price, but the server authenticates and authorizes the actor, creates an immutable Price inside the school's connected Stripe account, reads the provider result, and only then stores the Stripe identifiers and a local snapshot. Billing must resolve the stored Stripe Price on the correct connected account and verify its amount, currency, status, and product relationship before creating a provider transaction.

Changing a price creates a new Stripe Price. Existing agreements, invoices, and lesson snapshots retain the old Price identifier. Archiving an offering deactivates its Stripe Product/Price and does not erase history.

## Two kinds of credit

- A **lesson/service entitlement** means the school still owes instruction. It lives in Common Time's append-only domain ledger because Stripe cannot represent scheduling or service fulfillment.
- A **monetary account credit** changes what a payer owes. For Stripe-enabled schools it must be posted to that payer's Stripe Customer invoice-balance ledger. Common Time stores an immutable linked record, provider transaction ID, actor/reason, idempotency key, and reconciliation state.

Stripe customer-balance credits normally apply to the next finalized invoice and cannot be directed to an arbitrary invoice. The UI must say this plainly. A refund is a different operation and must reference the original Stripe charge/payment.

## Failure semantics

Every provider mutation is prepared locally before calling Stripe. Provider acceptance followed by a failed local finalization is `reconciliation_required`, never an ordinary failure. Retrying blindly is prohibited because it can create duplicate provider objects or credits. Operator reconciliation uses provider IDs and idempotency keys and preserves every attempt.

## Remaining implementation gates

- Verify Stripe Price details again when statements and payment intents are constructed; never charge from `price_cents` alone.
- Replace all price-edit paths with immutable Price replacement and archive the former Price after a successful cutover.
- Add the monetary-credit posting/reversal workflow against Stripe Customer balance transactions.
- Add webhook/reconciliation coverage and owner/platform operational views for catalog and credit failures.
- Backfill or explicitly retire `legacy_unsynced` offerings before they can produce new live charges.
