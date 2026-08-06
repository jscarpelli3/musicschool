# Payment Roadmap Audit Log

This is the append-only decision and evidence trail for the payment roadmap. Each step records its pre-implementation audit, material changes, exit audit, unresolved risks, and the decision to proceed, revise, split, or stop. Corrections are added as new entries rather than silently rewriting earlier findings.

## Audit entry format

- Step and status
- Date and commit range
- Intended outcome
- Pre-step direction review
- Systems of record and data mutations
- Security, tenancy, privacy, and provider boundary review
- Failure, retry, duplication, and recovery review
- Responsive/accessibility review when UI is involved
- Verification evidence
- Findings and changes made
- Unresolved risks or deferred work
- Exit decision and next-step impact

---

## Step 1 — Checkpoint and safety audit

Status: Complete  
Date: 2026-08-05  
Commits: `c5fff81`, `d2e3aa5`

### Intended outcome

Establish a durable, recoverable checkpoint for the owner-dashboard, scheduling, school-setup, and approval-link foundation before adding payment-provider code.

### Pre-step direction review

- Confirmed that no payment integration should proceed while the working tree contained a large uncommitted foundation.
- Confirmed Supabase remains the application system of record, Supabase Storage the media/document object store, GitHub the source checkpoint, and Stripe the future card/payment provider system of record.
- Confirmed transient view state such as an open dialog, hover, calendar browsing date, or horizontal scroll position does not represent business data and need not be persisted.
- Confirmed enabled controls that create, update, archive, approve, or configure durable behavior must report a database/provider result.

### Systems and mutation audit

- Verified school information, profiles, avatars, logos, offerings, spaces, approval requests/events, and user view preferences use Supabase or Supabase Storage.
- Verified roster column order and sorting are stored per profile and school in `user_view_preferences`.
- Verified the approval hold action calls the idempotent database approval function.
- Confirmed Policies/Documents creation remains disabled and does not simulate persistence.

### Findings and corrections

- Offering archive and space archive previously ignored database errors. They now require a returned updated row and display success or unchanged/error feedback.
- Roster view-preference persistence previously ignored database errors. It now throws on failure, serializes saves, and reports a visible retryable error.
- School, profile, avatar-reference, and logo-reference updates now verify that an authorized row was actually returned instead of treating a zero-row update as success.
- The owner dashboard previously converted failed related-data reads into empty arrays, which could resemble an empty school. Related dashboard query failures now fail the page explicitly.
- Added permanent rules forbidding client redirects from establishing payment truth and requiring visible, recoverable mutation failure.
- Added `docs/operations/data-recovery.md` covering database, Storage, source, provider-event, and restore-rehearsal requirements.

### Security and tenancy review

- Reviewed RLS enablement and policies for approval, policy, document, lesson-series, and view-preference tables.
- Searched application, migration, and documentation paths for Stripe secrets, webhook secrets, and Supabase service-role credentials; none were found.
- Confirmed raw payment credentials are not collected or stored anywhere in the current application.

### Verification evidence

- `git diff --check`: passed.
- ESLint: passed.
- TypeScript `tsc --noEmit`: passed.
- Next.js production build with webpack: passed.
- Supabase local/remote migration comparison: matched through `20260805105000`.
- Source checkpoint pushed to `main` at `c5fff81`; roadmap transition pushed at `d2e3aa5`.

### Unresolved risks and deferred work

- Supabase production must be upgraded to a plan with managed backups before live customer data.
- Supabase Storage objects require a separate export/replication process because database backups contain metadata, not object contents.
- A restore rehearsal has not yet been performed.
- Automated RLS and end-to-end mutation tests remain production-readiness work.
- Untracked `pnpm-lock.yaml` and `pnpm-workspace.yaml` remain intentionally excluded because the repository uses npm.

### Exit decision

Passed. Activate Step 2, Payment data foundation. The unresolved backup and automated-test items remain explicit production blockers, not blockers to designing the local ledger.

---

## Step 2 — Payment data foundation

Status: Complete
Activated: 2026-08-05
Completed: 2026-08-05

### Pre-step direction review

- Confirmed the local ledger should precede Stripe credentials, webhooks, onboarding UI, and charge controls.
- Confirmed the ledger must distinguish calculation, locked billing amount, payer approval, collection attempt, provider settlement, refund/dispute, and receipt state.
- Confirmed school-connected-account scope must be part of every provider customer, method, attempt, refund, dispute, and event reference.
- Confirmed monetary line items and accepted approval amounts must become immutable snapshots.
- Confirmed attempts and provider events need stable uniqueness/idempotency keys before any Stripe call is possible.
- Confirmed the existing `billing_accounts`, `billing_approval_requests`, and `billing_approval_events` should be extended and linked rather than replaced with parallel concepts.

### Account/provider readiness note

- The user reports that the MusicSchool Stripe Billing account has been started.
- This is recorded as platform-account progress only. Connect enablement, account configuration/responsibilities, test credentials, branding, and webhook endpoints are not yet verified.

### Systems of record and implemented model

- Supabase is the system of record for billing periods, immutable line-item snapshots, approvals, payment attempts, refunds, disputes, safe provider references, and reconciliation history.
- Stripe will remain the system of record for card credentials and provider settlement truth; no raw card or bank credentials were added to the application schema.
- Added test/live-scoped school payment connections, connected-account customer and payment-method references, explicit off-session consent evidence, billing periods and line items, payment attempts, refunds, disputes, provider events, and automatic state history.
- Linked approval requests to billing periods rather than creating a second approval concept.
- Retained the legacy `billing_accounts.stripe_customer_id` column for compatibility but marked it deprecated in favor of account-scoped provider-customer records.

### Failure, retry, duplication, and recovery review

- Composite foreign keys prevent cross-school, cross-billing-account, and cross-connection provider-reference mixing.
- Stable idempotency keys prevent duplicate payment attempts and refunds; provider event IDs are unique per provider account and environment.
- Billing totals are derived from line items and cannot be directly changed; line items become immutable when a period is locked.
- Period and attempt state transitions are constrained, and provider payload identifiers become immutable once recorded.
- An approved billing period requires a matching approved request for the same school, billing account, period, amount, and currency.
- Off-session attempts require active recorded consent for the selected payment method.
- Refund totals cannot exceed a succeeded attempt, and provider event payloads are immutable.
- State transitions are written automatically to payment history for later audit and reconciliation.

### Security, tenancy, and provider boundary review

- RLS is enabled on all new tenant tables. School admins can read the ledger and can edit billing periods/line items only while the period is still mutable.
- Provider-originated records and provider status transitions remain service-role operations; browser roles cannot declare payment success, failure, settlement, refunds, disputes, or webhook truth.
- Provider event payload tables expose no authenticated select/insert/update/delete policy or grant.
- No Stripe credentials or raw payment credentials were introduced.

### Verification evidence

- Applied `20260805110000_payment_ledger_foundation.sql` to linked Supabase project `twhexxokrjwzsoxgzlme`.
- Generated `src/types/database.ts` from the deployed linked schema.
- Applied `20260805111000_verify_payment_ledger_invariants.sql`; its transaction proved total derivation, amount tamper prevention, locked-line immutability, transition enforcement, attempt idempotency, and refund ceilings, then deliberately rolled back all fixtures.
- Supabase database lint at warning level: no schema errors found.
- ESLint: passed.
- TypeScript `tsc --noEmit`: passed.

### Unresolved risks and deferred work

- Browser-role RLS behavior needs automated positive and negative tests before production; schema policy inspection and database invariant tests are not a substitute for authenticated integration tests.
- Webhook ordering, replay, signature verification, and reconciliation cannot be tested until the verified webhook foundation exists.
- Refund and dispute ingestion is modeled but not implemented.
- Full backup/restore rehearsal, Storage export, monitoring, and live-account cutover remain production blockers.
- Currency is presently constrained within each ledger relationship, but the first live-school rehearsal must confirm the school's actual settlement currency and Stripe account country.

### Exit decision

Passed. Activate Step 3, Stripe platform configuration. The ledger now supplies durable prerequisites for provider integration without enabling any charge controls. Before writing Stripe code, verify Connect availability, test-mode credentials, connected-account responsibilities, and secret placement.

---

## Step 3 — Stripe platform configuration

Status: Complete
Activated: 2026-08-05
Completed: 2026-08-06

### Pre-step direction review

- Confirmed Stripe Connect is enabled for the MusicSchool platform account.
- Confirmed the platform model remains direct payments: each school is the seller and merchant of record, appears on receipts, and is responsible for its refunds and disputes.
- Selected Stripe-hosted onboarding so Stripe owns identity, bank, tax, and compliance data collection.
- Initially selected the Express Dashboard so schools could manage payout, identity, dispute, and provider-level settings in Stripe while MusicSchool owns lesson-aware billing workflows; provider validation later showed this was incompatible with the selected loss-responsibility model and the decision was corrected below.
- Confirmed no client-side Stripe package or publishable key is needed for the initial hosted onboarding flow.
- Confirmed charge controls remain disabled until connection state is reconciled through verified webhooks.

### Current implementation decision

- Add only Stripe's official server SDK and a server-only, lazily initialized client boundary.
- Require an explicit `STRIPE_MODE` and reject a secret-key prefix that does not match it, reducing accidental test/live crossover.
- Do not add secrets to source control, chat, browser environment variables, or Supabase application tables.
- Verify the connected-account country and test credentials before building account creation or onboarding-link mutations.

### Provider verification checkpoint

- A read-only Stripe API request accepted the configured test secret and confirmed the platform account country is `US`.
- The platform account itself is a standard Stripe account; future schools will be separate Express connected accounts.
- The existing ledger correctly denies browser-role writes to provider connection state. Added a separate, server-only Supabase administrative boundary for trusted Stripe mutations; its secret is loaded lazily and is never required during static build.
- The first onboarding attempt created no Stripe or Supabase record. An idempotent diagnostic replay identified a Stripe platform-profile gate requiring explicit confirmation of connected-account loss responsibility; Step 3 remains in progress until that provider requirement is completed.
- Follow-up validation established that legacy Express accounts implicitly assign payment losses to MusicSchool, contradicting the chosen direct-seller model in which Stripe covers unrecoverable school negative balances. Accounts v2 rejected the same incompatible combination explicitly.
- Corrected the integration to Accounts v2 with merchant configuration, full Stripe Dashboard, Stripe fee collection, Stripe requirement collection, and Stripe loss collection. Stripe accepted this configuration and created one idempotent test connected account; the app now reuses that account and Stripe's v2 hosted-onboarding links.
- The first application retry used the original idempotency key without the original response `include` parameters, so Stripe rejected the parameter mismatch and created no duplicate. The account-creation request was corrected to preserve the exact original parameters across retries.
- The corrected trace reused the existing account, persisted its onboarding state in Supabase, and generated a hosted onboarding link successfully. Completing the interactive onboarding is deferred while the owner's Stripe login recovery is pending; no account-ready state has been inferred or recorded.
- The owner later completed hosted test onboarding. A provider read initially showed one identity requirement, then a subsequent verified synchronization confirmed `details_submitted`, `charges_enabled`, and `payouts_enabled` with no currently due or pending-verification requirements.
- Expanded durable requirement state to include past-due fields, pending verification, safe requirement errors, and deadlines. The owner UI now translates Stripe field paths into actionable human tasks rather than displaying raw counts or generic restriction codes.
- Stripe return URLs now pass through an authenticated reconciliation route before returning to the Payments page. The persistent generic Synchronize button was removed; “Check Stripe again” appears only for pending review or a failed check, with usage guidance. Webhooks remain the planned continuous source of provider updates.

### Exit decision

Passed on 2026-08-06. Activate Step 4, Verified webhook foundation. Test credentials, Accounts v2 responsibility allocation, hosted onboarding, durable server-only secret handling, and a fully enabled test connected account are verified. Platform branding may continue to evolve but is not a blocker for webhook correctness.

### Roadmap reconciliation

- Step 5, Owner connection flow, was completed ahead of the nominal sequence as part of Step 3 verification rather than left pending behind webhooks.
- The earlier statement that future schools would be Express accounts is superseded: Accounts v2 with the full Stripe Dashboard is required for the selected allocation where Stripe collects fees, requirements, and unrecoverable account losses.
- Parent delivery direction changed from email-first to SMS-first. Supabase phone OTP provides authentication when a persistent portal session is absent; Twilio delivers access, approval, and reminder messages.

---

## Step 4 — Verified webhook foundation

Status: In progress
Activated: 2026-08-06

### Pre-step direction review

- Confirmed browser returns remain a convenience reconciliation path and cannot establish ongoing provider truth.
- Confirmed the deployed endpoint is scoped to Stripe test mode first and must use a distinct signing secret from future live and preview destinations.
- Confirmed raw request bytes must be verified before parsing or persistence.
- Confirmed immutable intake precedes processing, provider event IDs are unique, and duplicate delivery must return success without repeating mutations.
- Confirmed out-of-order account events will trigger retrieval of Stripe's latest account state rather than applying a stale event snapshot.
- Confirmed processing failures must remain visible and return a retryable non-2xx response.

### Initial implementation checkpoint

- Added the Node-runtime route `/api/stripe/webhooks` with Stripe signature verification and server-only signing-secret validation.
- Verified events are inserted once into the service-role-only immutable provider-event ledger and atomically claimed for processing.
- `account.updated` reconciles the latest connected-account state; unsupported events are durably classified as ignored until their handlers are implemented.
- Duplicate deliveries are acknowledged without repeating reconciliation. Failed processing is stored with a bounded error and returns HTTP 500 for Stripe retry.
- Production build and ESLint pass. Deployment, signing-secret configuration, real Stripe delivery, replay, concurrency, and out-of-order tests remain required before Step 4 can pass its exit gate.
- Stripe's destination Ping revealed that the configured destination uses v2 thin-event notifications. The endpoint was expanded to verify both v2 notifications through `parseEventNotificationAsync` and classic snapshot events through `constructEventAsync`; signed ping events are durably classified as ignored health checks.
