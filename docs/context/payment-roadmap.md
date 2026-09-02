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
- A chargeable offering must reference a Product and immutable Price in the school's own connected Stripe account. Browser-supplied and locally cached amounts are never charge authority.
- Service entitlements remain in Common Time's lesson ledger. Monetary credits for Stripe-backed payers are posted to Stripe Customer invoice balance and linked to an immutable local reconciliation record.

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

### 7. Monthly billing preparation — COMPLETE

- Actual occurrence-based calculation for three-, four-, and five-lesson months.
- Owner review, explained adjustments, and policy application.
- Immutable line-item snapshot and period locking.
- Exit gate passed on 2026-08-08: versioned series and occurrence prices, structured policy dispositions, atomic/idempotent family draft refresh, manual-adjustment preservation, explicit blockers, per-session three/four/five-month totals, fixed-monthly single-charge behavior, responsive owner review, and hold-to-lock immutability were verified.

### 8. Parent approval delivery — IN PROGRESS

- Bind approval requests to locked billing periods.
- Transactional email is the included/default delivery channel. Start with Resend and one authenticated Common Time sending domain; preserve school identity through the visible sender name and school reply-to address.
- Portal links use Supabase phone OTP when a durable device session is absent; payment approval remains a separate expiring, single-purpose token.
- Expiration, single use, idempotency, and consent evidence.
- Payers may approve or reject an exact proposal. Rejection captures a structured reason plus optional note, invalidates that proposal, and returns the untouched period to owner review for an explicit corrected version.
- Implemented foundation: locked-period approval snapshots plus the earlier shared-sender SMS delivery/status, webhook, and consent work. The channel-independent approval records remain valid.
- Required email work: payer email management, durable delivery attempts, verified provider webhooks, bounce/complaint suppression, owner send/resend controls, and responsive templates for approval and schedule access.
- Exit gate: complete an email approval-link send, provider reconciliation, replay, bounce/failure, supersession, and approval acceptance sequence. Charge execution remains Step 9 and cannot be inferred from delivery or approval.

### 8B. Owner adjustments and payer collection preference — IN PROGRESS

- Expose the existing durable manual-adjustment capability in the owner billing review. Owners may add credits or charges with an amount, category, and required explanation before locking.
- A locked or approved amount is immutable. Changing it creates a new draft/version, cancels the superseded pending approval, and requires fresh approval unless a valid standing auto-charge mandate covers the replacement amount.
- Let the payer explicitly choose per billing account between `approve_each_period` and `automatic_charge`. Saving a Stripe payment method alone never opts a payer into automatic collection.
- Standing auto-charge consent records the school, payer, billing account, selected payment method or default-method rule, permitted charge categories, cadence, optional monthly cap, advance-notice window, disclosure version, effective time, and revocation time.
- Every automatic month still produces and locks an itemized statement. Send the statement before collection; amounts beyond the mandate scope or cap fall back to one-time approval.
- Revocation takes effect before any new provider attempt. Material changes to scope, cap, cadence, or school require new payer consent; owner edits cannot broaden a mandate.
- Exit gate: prove adjustment auditability, supersession, opt-in, revocation, cap/scope fallback, notice delivery, and zero unauthorized charge attempts.
- Implemented foundation: owner charge/credit controls, audit-backed removal, pre-send unlock-to-revise, email-first owner state, separate mandate/enrollment/revocation records, cap and notice configuration, and structured payer proposal rejection. Live cross-flow rehearsal and long-lived payer revocation access remain.

### 8A. Per-school SMS add-on — DEFERRED / OPTIONAL

- SMS is a separately priced school add-on, not a prerequisite for billing, scheduling, or portal access.
- Common Time operates one Twilio parent account with an approved ISV Primary Customer Profile. Each participating school receives its own Twilio subaccount, dedicated toll-free number, Messaging Service, end-business verification, fixed public consent program, and school-scoped STOP/START/HELP state.
- Common Time pays the provider bill and may include a message allowance plus metered overage in the school add-on price. Schools do not need Twilio credentials or a Twilio billing relationship.
- Collect exact school legal/DBA, registration, address, website, and representative details before provisioning or submitting verification. SMS remains disabled until that school's number is approved.
- Consent is scoped to school + program version + recipient phone. It cannot authorize another school, and a generic form may not allow the recipient to type or substitute the sending school.
- Initial SMS content is transactional only: approval links, schedule access, lesson reminders, reschedules/cancellations, school closures, and payment status. Marketing and arbitrary bulk messaging remain out of scope.
- Store school Twilio connection and verification references, encrypted credential references, dedicated sender, consent events, and delivery records at the tenant boundary. Never place per-school secrets in ordinary database text.
- Cancellation disables sends immediately, preserves compliance evidence, retains the number for a defined grace period, and releases/transfers it only through an explicit offboarding operation.
- The currently rejected toll-free number may become the first school's dedicated test/production sender after a school-specific public consent page and corrected end-business resubmission. It may not be used as a shared multi-school sender.

### 9. Owner charge queue — PENDING

- Ready-to-charge work queue containing either an exact approved request or an active mandate that covers the exact locked amount.
- Durable attempt record created before the Stripe call.
- Stable idempotency key and duplicate-charge prevention.
- Decline and customer-authentication recovery.
- Resolve the exact connected-account Stripe Price and verify product, currency, amount, and active state before constructing every provider charge; do not use a browser amount or `service_products.price_cents` alone.

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

Finish Step 8 through email first: configure the authenticated Common Time sending domain, implement durable Resend delivery and verified webhook reconciliation, then pass send/replay/bounce/supersession/approval acceptance tests. In parallel, correct the first school's business and consent materials only if it purchases the SMS add-on; Twilio approval is no longer a payment-roadmap blocker. The first live school must publish an effective cancellation policy before current-month drafts containing cancellations or no-shows can be prepared. Do not begin charge execution until the email delivery exit gate passes.
