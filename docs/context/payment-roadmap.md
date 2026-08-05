# Payment Roadmap

This is the tracked implementation order for school-to-family payments. It is a living plan: steps may be split, reordered, or revised when a review gate exposes a safer or simpler path. A step is never marked complete merely because its UI renders.

The append-only evidence trail for every pre-step and exit audit is `docs/audits/payment-roadmap-audit-log.md`.

## Permanent invariants

- Each school is the merchant of record through its own Stripe connected account.
- Parents and students do not need Stripe accounts.
- Raw card or bank credentials never touch MusicSchool forms, servers, logs, or database.
- MusicSchool stores Stripe references and safe display metadata only.
- Amount calculation, payer approval, collection, settlement, and receipt are distinct states.
- Money and consent records are immutable snapshots once submitted or approved.
- A browser redirect or client callback never establishes payment truth.
- Verified, idempotent Stripe webhooks establish provider truth.
- Every retryable provider mutation uses a stable idempotency key.
- No enabled control may imply success before durable persistence succeeds.

## Review gate used before every step

1. Restate the outcome and confirm it still serves the first school without hard-coding that school.
2. Identify the system of record for every state the step reads or writes.
3. Recheck tenant isolation, owner/staff/payer authorization, secrets, PCI boundaries, and exposed personal data.
4. Identify prerequisites, provider accounts, environment variables, costs, rate limits, and external review requirements.
5. Enumerate duplicate, timeout, partial-failure, stale-state, cancellation, and retry paths.
6. Check schema compatibility with monthly occurrence billing, alternative school policies, and future collection modes.
7. Check desktop, tablet, phone, keyboard, and reduced-motion behavior for any UI in the step.
8. Adjust the step or roadmap before implementation when any assumption no longer holds.

## Exit gate used after every step

1. Confirm writes exist in the intended database/provider and reads return that durable state.
2. Confirm failures are visible, recoverable, and never presented as success.
3. Confirm idempotency and uniqueness prevent duplicate money, consent, messages, and provider events.
4. Run proportional automated tests plus lint, TypeScript, and production build checks.
5. Confirm local and remote migration history match when the schema changed.
6. Review RLS and server authorization independently of hidden or disabled UI.
7. Update architecture, decision, status, cost, and operational documentation.
8. Append the audit results and evidence to `docs/audits/payment-roadmap-audit-log.md`.
9. Commit a coherent checkpoint and reassess the next step before activating it.

## Tracked steps

### 1. Checkpoint and safety audit — COMPLETE

- Commit the current owner-dashboard and approval-link foundation.
- Verify remote migration parity.
- Record backup and Storage-export requirements.
- Inventory enabled mutations and eliminate silent failure paths.
- Freeze payment invariants and acceptance criteria.
- Recovery requirements are documented in `docs/operations/data-recovery.md`; production still requires a paid backup plan and a tested Storage export/restore process.
- Exit gate passed in commit `c5fff81`: build/type/lint clean, local and remote migrations aligned, silent dashboard/mutation failures closed, and source pushed to GitHub.

### 2. Payment data foundation — IN PROGRESS

- School Stripe connection state.
- Billing periods and immutable line items.
- Connected-account customer and payment-method references.
- Payment attempts, refunds, disputes, and provider events.
- Stable idempotency and reconciliation keys.

### 3. Stripe platform configuration — PENDING

- Test credentials and Connect configuration.
- Connected-account responsibilities and capabilities.
- Platform and connected-account branding.
- Server-only environment-secret handling.

### 4. Verified webhook foundation — PENDING

- Signed Connect webhook endpoint.
- Immutable event intake with unique provider event IDs.
- Account and payment state reconciliation.
- Retry, out-of-order delivery, and replay handling.

### 5. Owner connection flow — PENDING

- School Setup → Payments.
- Stripe-hosted connected-account onboarding.
- Requirements, charges-enabled, and payouts-enabled status.
- Expired-link, return, reconnect, and remediation paths.

### 6. Parent payment-method setup — PENDING

- Connected-account Customer creation.
- Stripe-hosted SetupIntent or Checkout setup flow.
- Explicit future off-session consent evidence.
- Safe card brand, last-four, expiry, and default-method display.

### 7. Monthly billing preparation — PENDING

- Actual occurrence-based calculation for three-, four-, and five-lesson months.
- Owner review, explained adjustments, and policy application.
- Immutable line-item snapshot and period locking.

### 8. Parent approval delivery — PENDING

- Bind approval requests to locked billing periods.
- Email delivery first; SMS delivery second.
- Expiration, single use, idempotency, and consent evidence.

### 9. Owner charge queue — PENDING

- Approved and ready-to-charge work queue.
- Durable attempt record created before the Stripe call.
- Stable idempotency key and duplicate-charge prevention.
- Decline and customer-authentication recovery.

### 10. Settlement, receipts, and operations — PENDING

- Webhook-driven success, failure, refund, and dispute state.
- Stripe-issued payment receipts.
- Owner exception handling and reconciliation views.

### 11. Production readiness — PENDING

- RLS, integration, webhook replay, and payment-state tests.
- Database backup and Storage-object export procedures.
- Monitoring, alerts, runbooks, and live credential cutover.
- Full first-school rehearsal with Stripe test clocks/cards where applicable.

## Current next action

Design and migrate the payment ledger with immutable monetary snapshots, tenant-scoped provider references, and explicit attempt/event/reconciliation state before adding Stripe credentials or payment controls.
