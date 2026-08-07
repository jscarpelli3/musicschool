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

Status: Complete
Activated: 2026-08-06
Completed: 2026-08-07

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
- The first correctly signed test-mode Ping reached intake but Supabase rejected persistence before creating a row. Test-mode responses now expose only the safe PostgREST error code/message for diagnosis; secrets and payload contents remain suppressed.

### Part A — destination subscription and intake audit

- Completed: 2026-08-07.
- The Stripe test destination was subscribed to the required Accounts v2 lifecycle, merchant-configuration, capability-status, requirements, future-requirements, identity, and defaults events.
- A post-configuration test Ping returned HTTP 200 from the deployed Vercel endpoint.
- Supabase contains the exact event `evt_test_65VBDDabor94xajrjFd16TWt6q7JSQv0fPSrbryXWYyIBc` as a test-mode `v2.core.event_destination.ping` record.
- The event was claimed once, intentionally classified as `ignored`, completed without an error, and retained in the immutable provider-event ledger.
- Audit result: passed. Signature verification, delivery, durable intake, single processing attempt, and safe no-op handling are operating together. Proceed to a real Accounts v2 event; Step 4 as a whole remains in progress.

### Part B — first real account-event attempt

- Started: 2026-08-07.
- A metadata-only update was accepted by Stripe but produced no destination delivery; metadata is not used as the definitive event trigger.
- A reversible top-level `display_name` update generated `v2.core.account.updated` in Stripe, and Stripe also generated an identity update during the same test window.
- Neither real account event reached the Vercel endpoint or Supabase ledger, while destination Pings continued to succeed. This isolates the current gap to Stripe event routing rather than signature verification or application intake.
- The connected account's original display name, `ScarpsSchool`, was restored immediately after the test.
- Audit result: incomplete. Before another mutation, verify that the destination's event source is configured for connected accounts and inspect the generated event's delivery-attempt view.

### Part B — platform routing correction and successful real event

- Completed: 2026-08-07.
- Stripe generated platform-initiated Accounts v2 updates without connected-account context, so they did not match the connected-accounts-only destination. Stripe does not allow changing a destination's event source after creation.
- Added an optional, separately named platform-destination signing secret. The endpoint now verifies each request against the configured destination secrets while retaining one immutable intake and processing path.
- Created a second thin-event destination for events from the platform account. Its first Ping returned HTTP 200 and was stored once as intentionally ignored with no processing error.
- A reversible display-name update produced `evt_test_65VBH9PyIQYFR4PVQZ216TWt6q7JSQv0fPSrbryXWYyK2C`; the event was delivered, stored, claimed once, and processed without error.
- Restoring the original `ScarpsSchool` display name produced `evt_test_65VBH9nM2cRzu5xRzZ216TWt6q7JSQv0fPSrbryXWYyBom`; it also processed exactly once without error.
- Latest-state reconciliation resolved the event's account to school `74d60cb7-1217-4fef-bb74-2c659a83722b` and durably confirmed test mode, submitted details, enabled charges, enabled payouts, and no disabled reason.
- Audit result: passed. Real Accounts v2 delivery, account-to-school resolution, and latest-state reconciliation are verified. Proceed to duplicate, concurrency, replay, and out-of-order tests.

### Part C — replay, concurrency, and ordering audit

- Completed: 2026-08-07.
- Manually resent the already processed restoration event from Stripe. The endpoint returned HTTP 200 with `duplicate: true`; its single immutable row retained `processing_attempts = 1` and its original timestamps.
- Sent eight simultaneous, correctly signed test-mode notifications with one unique audit event ID. All returned HTTP 200: one request processed the event and seven were acknowledged as duplicates.
- The concurrency event was retained as one row, processed once, and completed without error.
- Delivered a correctly signed account notification with a deliberately stale provider timestamp of 2025-01-01. The ledger retained that historical provider time while the handler retrieved Stripe's current account state.
- After the stale event, the school remained enabled with submitted details, charges and payouts enabled, no disabled reason, and a fresh reconciliation timestamp.
- Audit result: passed. Immutable deduplication, atomic claiming, concurrent delivery handling, and latest-state reconciliation prevent repeated or stale event application. Proceed to failed-event retry and recovery.

### Part D — failure, retry, and abandoned-work recovery audit

- Completed: 2026-08-07.
- Pre-test review found that a worker crash after claim could leave an event permanently stuck in `processing`. Replaced the split status/attempt updates with one database claim operation and added a five-minute processing lease.
- The claim function is executable only by the service role. It atomically claims new and failed events, increments attempts, and reclaims only expired processing leases.
- A correctly signed synthetic event for an unmapped test account returned HTTP 500 and remained durably `failed` on attempt 1 with no processed timestamp and a bounded actionable error.
- A valid synthetic audit event was staged as a transient failure. Redelivery reclaimed it, processed successfully on attempt 2, and cleared the prior error.
- The same audit event was staged with an expired processing lease. Redelivery reclaimed it, processed successfully on attempt 3, and refreshed the lease timestamp.
- After recovery, the real school connection remained enabled with submitted details, charges and payouts enabled, no disabled reason, and a fresh Stripe reconciliation timestamp.
- Linked database lint, application lint, TypeScript, and the production build passed before deployment. Remote migration history includes `20260807193000_atomic_provider_event_claims.sql`.

### Exit decision

Passed on 2026-08-07. Step 4 is complete. Verified webhooks now provide signed immutable intake, account-to-school resolution, latest-state reconciliation, duplicate and concurrency safety, stale-event safety, visible retryable failure, and abandoned-work recovery across both connected-account and platform-account Accounts v2 destinations. Activate Step 6 because Step 5 was completed early during Stripe platform setup.

---

## Step 6 — Parent payment-method setup

Status: In progress
Activated: 2026-08-07

### Pre-step direction review

- Confirmed parents do not need Stripe accounts and MusicSchool must never receive raw card or bank credentials.
- Selected Stripe-hosted Checkout in setup mode rather than embedded Elements or a custom form. No client-side Stripe package is required.
- Customers and reusable payment methods belong to each school's connected Stripe account so later direct charges preserve the school as merchant of record.
- A setup request must be durable before redirect and bind school, family billing account, connected-account Customer, Checkout Session, expiration, initiator, and an exact versioned authorization statement.
- The authorization is limited to future off-session lesson or class amounts the payer separately approves; setup does not itself approve a monthly amount.
- Browser success returns remain informational. Verified connected-account Checkout webhooks retrieve current Stripe state and atomically persist safe method details plus consent evidence.
- Checkout and SetupIntent are API v1 resources. Because thin v1 events remain preview-only, add a separate connected-account snapshot destination rather than weakening or replacing the verified Accounts v2 destinations.
- The owner-facing launch control must work on desktop, tablet, and phone; Stripe owns the responsive hosted card-entry surface.
