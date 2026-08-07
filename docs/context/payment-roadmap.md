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

### 2. Payment data foundation — COMPLETE

- School Stripe connection state.
- Billing periods and immutable line items.
- Connected-account customer and payment-method references.
- Payment attempts, refunds, disputes, and provider events.
- Stable idempotency and reconciliation keys.
- Exit gate passed on 2026-08-05: linked-schema migration and transactional invariant rehearsal succeeded; generated database types, lint, TypeScript, and database lint passed.

### 3. Stripe platform configuration — COMPLETE

- Test credentials and Connect configuration.
- Connected-account responsibilities and capabilities.
- Platform and connected-account branding.
- Server-only environment-secret handling.
- Exit gate passed on 2026-08-06: the test connected school account reached details-submitted, charges-enabled, and payouts-enabled with no outstanding requirements; return synchronization and human-readable requirement status are durable.

### 4. Verified webhook foundation — COMPLETE

- Signed Connect webhook endpoint.
- Immutable event intake with unique provider event IDs.
- Account and payment state reconciliation.
- Retry, out-of-order delivery, and replay handling.
- Exit gate passed on 2026-08-07: both Accounts v2 event sources are signed and durable; real delivery, latest-state reconciliation, exact replay, concurrent delivery, stale ordering, visible failure, failed retry, and abandoned-lease recovery were verified against the deployed test integration.

### 5. Owner connection flow — COMPLETE

- School Setup → Payments.
- Stripe-hosted connected-account onboarding.
- Requirements, charges-enabled, and payouts-enabled status.
- Expired-link, return, reconnect, and remediation paths.
- Implemented ahead of Step 4 while validating platform configuration; test onboarding reached charges-enabled and payouts-enabled, and the owner UI now explains actionable requirements and automatically reconciles on return.

### 6. Parent payment-method setup — COMPLETE

- Connected-account Customer creation.
- Stripe-hosted SetupIntent or Checkout setup flow.
- Explicit future off-session consent evidence.
- Safe card brand, last-four, expiry, and default-method display.
- Exit gate passed on 2026-08-07: hosted connected-account setup, webhook truth, consent evidence, expiration, replacement/default selection, revocation, late replay safety, and browser-role denial were verified in test mode.

### 7. Monthly billing preparation — IN PROGRESS

- Actual occurrence-based calculation for three-, four-, and five-lesson months.
- Owner review, explained adjustments, and policy application.
- Immutable line-item snapshot and period locking.

### 8. Parent approval delivery — PENDING

- Bind approval requests to locked billing periods.
- SMS delivery first through Twilio; email is deferred.
- Portal links use Supabase phone OTP when a durable device session is absent; payment approval remains a separate expiring, single-purpose token.
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

Step 7 Part A is complete. Build Part B: deterministic, policy-aware occurrence dispositions that explicitly classify each lesson as charge, waive, credit, or owner review before any monthly draft is calculated. SMS delivery remains Step 8.
