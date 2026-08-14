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

Status: Complete
Activated: 2026-08-07
Completed: 2026-08-07

### Pre-step direction review

- Confirmed parents do not need Stripe accounts and MusicSchool must never receive raw card or bank credentials.
- Selected Stripe-hosted Checkout in setup mode rather than embedded Elements or a custom form. No client-side Stripe package is required.
- Customers and reusable payment methods belong to each school's connected Stripe account so later direct charges preserve the school as merchant of record.
- A setup request must be durable before redirect and bind school, family billing account, connected-account Customer, Checkout Session, expiration, initiator, and an exact versioned authorization statement.
- The authorization is limited to future off-session lesson or class amounts the payer separately approves; setup does not itself approve a monthly amount.
- Browser success returns remain informational. Verified connected-account Checkout webhooks retrieve current Stripe state and atomically persist safe method details plus consent evidence.
- Checkout and SetupIntent are API v1 resources. Because thin v1 events remain preview-only, add a separate connected-account snapshot destination rather than weakening or replacing the verified Accounts v2 destinations.
- The owner-facing launch control must work on desktop, tablet, and phone; Stripe owns the responsive hosted card-entry surface.

### First connected-account setup checkpoint

- Added a durable, expiring setup-request record and a service-role-only completion transaction. Browser roles cannot create provider customers, payment methods, or consent records directly.
- Added Stripe-hosted Checkout setup creation on the school's connected account with a stable Customer idempotency key and no client-side Stripe dependency.
- The first launch safely failed because Stripe API `2026-07-29.dahlia` no longer accepts the formerly documented `ui_mode=hosted` value. The request remained auditable as failed and stored no Checkout Session or card data; removing the redundant parameter uses Stripe's hosted default.
- The second launch completed with Stripe test card 4242. Snapshot event `checkout.session.completed` was signed, stored once, processed once, and reconciled from the connected account without error.
- Supabase durably contains the completed setup request, one active default Visa ending in 4242, and an off-session consent record tied to the exact Checkout Session and SetupIntent. Only brand, last four, expiration, and provider references are stored.
- The return page remained informational until webhook reconciliation. The failed attempt remains visible in recent setup activity rather than being erased.
- Usability review clarified that the owner normally sends the hosted link to the payer. Replaced the direct owner redirect with a copyable 24-hour payer link and a separately labeled assisted-setup option; also removed duplicated card labeling.
- Checkpoint result: passed. Core hosted setup and verified persistence work end to end in test mode. Step 6 remains in progress for link expiration/replay tests, replacement/default behavior, consent revocation, and the later SMS delivery integration.

### Expiration and replacement checkpoint

- Created an unused payer setup link and expired its exact Checkout Session through Stripe. `checkout.session.expired` was signed, stored, and processed once; only that setup request became expired, with no completion timestamp.
- Expiration left the existing Visa ending in 4242 active and default, proving an abandoned link cannot disturb a saved method.
- Completed a second hosted setup using Stripe test Mastercard ending in 4444. Its event processed once and produced a distinct consent tied to its own SetupIntent.
- The completion transaction retained Visa as active history, removed its default flag, and made Mastercard the sole default. Neither prior consent nor setup history was overwritten.
- Added a two-phase revocation design: consent is revoked and the method becomes non-chargeable `detaching` before the Stripe API call; provider success then finalizes `detached`. A retryable provider failure therefore fails closed rather than leaving charge permission active.
- Reused the hold-to-confirm interaction for removal. The control stacks on phone and aligns beside method details at wider breakpoints.
- Checkpoint result: expiration and replacement passed. Revocation implementation is deployed to the database but requires an end-to-end provider test before its audit can pass.

### Revocation, replay, and authorization checkpoint

- Removed the current default Mastercard through the owner hold-to-confirm control. Consent was revoked before provider detachment, Stripe confirmed the method no longer has a Customer, and the method finalized as detached.
- The remaining active Visa automatically became the sole default. Revocation-started and revocation-completed audit entries identify the acting owner.
- Replayed the old Mastercard `checkout.session.completed` event after revocation by staging it as retryable and resending from Stripe. It processed on attempt 2 without reactivating the card, restoring consent, changing the default, or inserting duplicate consent.
- Removed an unused hashed setup-token column. Stripe's hosted Session URL is the actual payer bearer link; retaining an unrelated unused token would add ambiguity without protection.
- Anonymous credentials can read no setup-request rows. Both the revocation and setup-completion RPCs return HTTP 401 permission denied when called with the public key.
- Final application lint, TypeScript, production build, linked database lint, remote migration parity, mobile stacking, and desktop/tablet alignment passed.

### Exit decision

Passed on 2026-08-07. Step 6 is complete. Parent card setup is hosted by Stripe on the school's connected account; MusicSchool stores only safe references and versioned consent evidence. Expiration, replacement, default fallback, revocation, replay, partial-failure safety, and browser authorization are verified. Activate Step 7, Monthly billing preparation; SMS delivery of payer setup and approval links remains Step 8.

---

## Step 7 — Monthly billing preparation

Status: In progress
Activated: 2026-08-07

### Pre-step direction review

- Confirmed monthly billing must support three-, four-, and five-occurrence months and must not assume four weekly lessons.
- Confirmed the current catalog explicitly prices offerings per session, while the school-level default still says fixed monthly. Existing amounts therefore cannot safely be reinterpreted as monthly tuition.
- Found that lesson series referenced a mutable catalog offering without preserving agreed billing terms. A later catalog edit could otherwise change a historical draft before it was locked.
- Split Step 7 into a versioned-terms foundation, deterministic occurrence and policy resolution, transactional draft generation, and owner review/locking.
- Fixed-monthly terms will produce one series charge per covered calendar month. Per-session terms will produce one charge per billable occurrence. Credits and exceptions remain explicit line items rather than hidden arithmetic.
- Draft generation must stop visibly when a student has no billing account, ambiguous billing-account ownership, missing terms, unresolved outcomes, or mixed currencies.
- No parent delivery or Stripe charge occurs in this step. Those remain separate approval and collection states in Steps 8 and 9.
- The review UI will use a stacked phone layout and a denser table at tablet/desktop widths; no billing action will depend on hover.

### Part A — versioned billing terms checkpoint

- Added a tenant-scoped, non-overlapping lesson-series billing-term history with immutable mode, amount, currency, offering name, source product, and effective date snapshots.
- Existing series inherit the catalog's explicit pricing model and amount. This deliberately avoids inventing fixed-monthly tuition from the stale school default.
- Billing line items can identify the exact term version used and can distinguish a monthly lesson-series charge from an occurrence charge.
- Database deployment, backfill validation, RLS denial, generated types, lint, and build remain required before Part A passes.
- The migration deployed cleanly and linked database lint reports no schema errors. The live project currently has zero lesson-series rows; its seeded calendar entries are standalone lesson occurrences, so the historical backfill correctly inserted zero term rows.
- Anonymous reads return an empty result under RLS. A transactional database rehearsal will create temporary linked records, prove overlap and mutation guards, and intentionally roll all rehearsal data back before Part A is marked complete.

### Part A exit decision

Passed on 2026-08-07.

- Remote migrations `20260807230000` and `20260807231000` are applied and local/remote history matches exactly.
- The self-rolling-back rehearsal proved overlapping effective periods are rejected, price snapshots cannot be edited, and an open term can be closed exactly once. No rehearsal business rows remain.
- The public publishable key can read no term rows and an anonymous insert is rejected with HTTP 401. Member and owner/admin access remains tenant-scoped through RLS.
- Generated TypeScript types now come directly from the deployed schema. Their stricter nullability exposed and fixed optional lesson-RPC arguments and required Stripe card-display fields.
- Linked database lint, ESLint, TypeScript, and the production webpack build pass. The initial sandboxed build could not resolve Google Fonts; the identical network-enabled build compiled and prerendered successfully.
- Step 7 remains in progress. Part B will model deterministic policy-aware occurrence dispositions before draft generation; no amount approval or charge has been activated.

### Part B — policy-aware occurrence dispositions

- Started: 2026-08-07.
- Added the previously missing structured timely-cancellation disposition, defaulting to waive for new and existing draft rules.
- Published policy versions and their structured cancellation/payment rules become immutable; policy changes require a new version instead of rewriting historical behavior.
- Added an owner/admin-only, read-only disposition preview. It classifies serviced, partial, rescheduled, cancelled, and no-show occurrences from structured facts and the effective published cancellation policy.
- Future scheduled lessons return `not_ready`; past scheduled lessons with no outcome, missing effective policies, manual-review policy results, and ambiguous facts return `owner_review`. No draft generator may silently skip those blockers.
- Teacher-policy `refund` maps to a pre-collection credit, while `makeup` maps to waiver of the original occurrence; the original structured policy result remains in the preview for explanation and later entitlement work.
- Deployment and scenario verification remain required before Part B passes.
- The live no-policy matrix passed: completed lessons resolve to charge, rescheduled originals to waive, future scheduled lessons to not ready, and cancellations/no-shows to owner review because no effective published school policy exists yet.
- Anonymous callers receive HTTP 401 from the preview RPC. A self-rolling-back published-policy rehearsal remains before the Part B exit gate.

### Part B exit decision

Passed on 2026-08-07.

- A self-rolling-back published-policy rehearsal proved timely cancellation waiver, late-cancellation charge, manual-review no-show handling, teacher-cancellation credit, exact policy-version attribution, and published-rule immutability.
- The live no-policy matrix and synthetic published-policy matrix both passed, covering every resolver branch without creating billing periods, line items, approvals, or Stripe operations.
- Both rehearsal residue checks returned zero rows. Anonymous preview access is denied with HTTP 401, while the internal computation helper remains service-role-only.
- Remote migration history is aligned through `20260807233000`. Linked database lint, generated types, ESLint, TypeScript, and the production webpack build pass.
- Step 7 remains in progress. Part C will transactionally generate reviewable family drafts and must abort on unresolved facts instead of silently omitting them.

### Part C — transactional monthly draft generation

- Started: 2026-08-07.
- Preflight found that the current lesson-entry flow creates standalone occurrences, while Part A only preserved recurring-series terms. Reading a mutable catalog price during draft generation would therefore be unsafe.
- Added an immutable per-occurrence price snapshot captured automatically by a database trigger in the same transaction as every lesson event. Series occurrences must resolve an effective versioned series term; standalone lessons must use an explicit per-session offering.
- Existing occurrences are known seeded/demo standalone lessons and are backfilled from their current explicit per-session catalog values before any billing draft feature is activated.
- Billing line items can identify both the exact occurrence snapshot and, for recurring lessons, the originating series-term version.
- Deployment, automatic-capture rehearsal, backfill parity, and authorization checks remain required before draft generation itself begins.
- The first deployment attempt safely rolled back because `lesson_events` lacked a tenant-composite unique key required by the new foreign key. Added `(school_id, id)` as an explicit unique invariant and the corrected migration deployed atomically.
- The live backfill has exact parity: 84 lesson events and 84 immutable price snapshots. A self-rolling-back insert rehearsal remains to prove automatic capture and mutation denial.
- The automatic-capture rehearsal passed and rolled back both its temporary lesson and snapshot. Snapshot mutation was rejected; anonymous reads return zero rows and anonymous inserts receive HTTP 401.
- Remote migrations align through `20260807235000`; linked database lint, regenerated types, ESLint, TypeScript, and the production webpack build pass.
- Mid-step direction review clarified that a monthly amount is normally prepared from materialized scheduled occurrences before every lesson is serviced. The generator should treat a future scheduled occurrence as an expected charge, while a past scheduled occurrence with no recorded outcome remains an owner-review blocker. This supersedes using `not_ready` as the final generator behavior; the resolver will be adjusted transactionally with the draft implementation.
- Price-snapshot prerequisite passed. Part C remains in progress because no billing period or line-item generator has been activated yet.
- Live preflight confirmed 12 student-to-family mappings with zero ambiguity. Added a unique school/student mapping invariant so a future student cannot silently belong to two billing accounts.
- Implemented an owner/admin-only atomic family/month draft preparer. It serializes concurrent refreshes, preserves manual adjustments, rebuilds only generated lesson lines, and reuses the existing period uniqueness and amount-recalculation guards.
- Upcoming scheduled occurrences become expected per-session charges; past unresolved occurrences and missing policies abort. Waived/pre-collection credited per-session occurrences remain visible at zero dollars. Fixed-monthly series receive one base charge, while partial months, mid-month term changes, and credits requiring an unspecified amount abort for owner review.
- Deployment and transactional scenario verification remain required.
- The generator deployed cleanly. A self-rolling-back database rehearsal will now verify expected future charges, exact refresh idempotency, manual-adjustment preservation, review-to-draft refresh behavior, unresolved-past blocking, and absence of partial periods after failure.
- The draft rehearsal passed and left zero residue for both its successful and blocked months. Added an owner/admin-only idempotent lock transaction that advances draft/review periods through the existing guarded state machine and records the lock in the audit log.
- A rollback-only lock rehearsal will verify positive-line enforcement, locked timestamps, post-lock line immutability, and refresh rejection before the control is enabled in the owner UI.
- The lock rehearsal passed. The owner review surface now exposes month preparation, durable success/blocker feedback, expandable line explanations, paid-versus-draft truth, and a reusable hold-to-lock control. Phone rows stack while tablet/desktop rows align descriptions and amounts; no action depends on hover.
- Added an explicit rollback-only three-/four-/five-lesson acceptance test before the Step 7 exit gate.
- The per-session acceptance test passed: three, four, and five materialized occurrences generated exactly three, four, and five lines and their corresponding price multiples, with zero residue afterward.
- Added the final fixed-monthly acceptance test: one series tuition line plus visible zero-dollar occurrence explanations, without multiplying tuition by the number of lessons.
- The fixed-monthly acceptance test passed: one tuition line, four visible zero-dollar occurrence explanations, and a total equal to one monthly tuition amount. All rehearsal periods, series, lessons, terms, snapshots, lines, history, and audit entries rolled back.

### Step 7 exit decision

Passed on 2026-08-08.

- Versioned series terms and immutable occurrence price snapshots prevent catalog edits from rewriting a historical or pending month.
- Policy resolution is structured, effective-dated, and attributable to an immutable published version. Missing policy and ambiguous outcome paths stop at owner review.
- Family draft preparation is atomic, refresh-idempotent, serialized per family/month, preserves manual adjustments, and leaves no partial period after a blocker.
- Per-session three-, four-, and five-lesson months and one-charge fixed-monthly tuition were verified with rollback-only database acceptance tests.
- The owner can prepare or refresh a month, expand its explained line items, distinguish paid provider truth from draft totals, and hold to lock the exact reviewed amount. Locked lines and scope reject mutation and refresh.
- Anonymous preparation and lock RPCs are not exposed. Tenant mappings enforce one billing account per student. Remote migrations align, database lint reports no errors, generated types, ESLint, TypeScript, and the production build pass.
- Phone controls and line items stack; tablet and desktop layouts align descriptions and amounts. Keyboard users can operate the hold control, and no billing action depends on hover.
- The real school currently has no published cancellation policy. This is a deliberate visible blocker for months containing cancellations or no-shows, not a failed or partial invoice.
- Activate Step 8: create an expiring approval request bound to a locked period and deliver the link by Twilio SMS. No charge is authorized by merely preparing or locking a draft.

### Step 8 activation — SMS consent foundation

Activated on 2026-08-09.

- Created and funded the MusicSchool Twilio account, created the first Messaging Service, and began toll-free sender verification.
- Added a public, optional web-form enrollment flow at `/sms-consent`. Its checkbox is blank by default and separates transactional SMS consent from payment authorization and email preferences.
- The CTA identifies MusicSchool and the named school, lists the transactional message purposes, states variable frequency and possible message/data rates, provides HELP/STOP instructions, and states that consent is not a condition of purchase.
- Added publicly accessible SMS Terms, Privacy, and Support routes linked directly beside the CTA.
- Added append-only SMS opt-in evidence with normalized E.164 phone, person and school labels, source, canonical disclosure version/text, timestamp, and program metadata. Public callers cannot choose or rewrite the stored legal wording.
- The constrained public function records only opt-in events and deduplicates rapid repeats. The underlying table has RLS enabled with no direct anonymous access.
- A rollback-only rehearsal proved canonical evidence storage and rapid-submit idempotency without leaving test data.
- Supabase types, TypeScript, ESLint, and the production build passed. Commit `03f6394` is live, and the consent, privacy, terms, and support routes return HTTP 200.
- Toll-free approval, provider credentials, delivery records, signed callbacks, owner send/resend UI, opt-out synchronization, and end-to-end SMS delivery remain pending.

### Step 8 checkpoint — durable approval delivery foundation

Completed on 2026-08-09 while toll-free verification remained in review.

- Added a durable `sms_deliveries` ledger. A delivery row is created before any provider request and stores the recipient, provider identifiers, lifecycle state, error state, and a SHA-256 body fingerprint—never the approval URL or raw message body.
- Added a single transaction that snapshots an exact locked billing period into a versioned approval request, cancels any superseded pending request, records immutable approval/audit events, and prepares the pending SMS attempt.
- A rollback-only database rehearsal proved locked-to-pending transition, exact amount and line-item snapshots, request replacement, cancellation history, version increments, and pre-provider durability without leaving test billing data.
- Added a server-only Twilio REST adapter using the scoped API key and Messaging Service. No Twilio SDK dependency was necessary.
- Regenerated database types; TypeScript and ESLint passed.
- Toll-free sender approval is still the only external blocker to a real handset delivery. Signed delivery callbacks, owner send UI, STOP/HELP webhook handling, and live end-to-end testing remain pending.

### Step 8 checkpoint — signed callbacks and owner approval send

Completed on 2026-08-09 while toll-free verification remained in review.

- Added a signed `POST /api/twilio/status` callback. It accepts only form-encoded requests, validates `X-Twilio-Signature` against the exact configured callback URL with Twilio's maintained validator, and rejects callbacks for another account.
- Added append-only, fingerprinted provider status events. Duplicate callbacks are idempotent, callbacks that race the initial API response wait for reconciliation, and late lower-rank events cannot regress a delivered message.
- Added owner/admin approval-link sending to locked family billing periods. The action requires a valid payer phone and matching recorded opt-in, snapshots and versions the exact charge, creates durable local records before calling Twilio, and records provider rejection.
- The family billing UI now shows the latest delivery state and supports a new link; generating one cancels the superseded pending approval rather than leaving two usable links.
- Added Twilio's official server library solely for maintained webhook signature validation. Outbound submission remains a small server-only REST adapter.
- Database rehearsals for replay, out-of-order delivery, and the callback/API-response race passed without persistent fixture data. TypeScript, ESLint, and the production build passed. The earlier local build stall was isolated to sandboxed build-time font access.
- Live deployment, real SMS delivery, inbound STOP/HELP synchronization, and owner-facing phone/consent editing remain pending. Toll-free sender approval still blocks only the real handset test.

### Step 8 checkpoint — inbound consent synchronization

Completed on 2026-08-09 while toll-free verification remained in review.

- Added a signed `POST /api/twilio/incoming` webhook scoped to the configured Twilio account and Messaging Service. Unknown message content receives empty TwiML and is not retained.
- STOP-family, START/UNSTOP, and HELP/INFO keywords are recorded append-only and replay-safe. Twilio Advanced Opt-Out remains responsible for the compliant customer reply, avoiding duplicate responses from MusicSchool.
- Consent state now has explicit monotonic ordering. The first rollback rehearsal exposed identical transaction timestamps making STOP/START order ambiguous; an identity sequence fixed the defect, and the repeated audit passed.
- A STOP applies globally across the shared MusicSchool Messaging Service. A later web form cannot override it; the payer must text START or UNSTOP. HELP is recorded without changing consent.
- Replaced the incorrect outbound `opt_in` string check with one database consent-state function using the ledger's real `opted_in`/`opted_out` values.
- Added owner/admin payer-phone editing backed by the `people` table, live consent status, and a school-prefilled public consent-form link. No UI-only phone or consent state exists.
- TypeScript and ESLint passed. Production build and deployment validation follow in this checkpoint.

### Step 8 operations checkpoint — Messaging Service configuration

Recorded on 2026-08-09.

- The temporary deployed origin is configured for Messaging Service inbound POST, fallback POST, and outbound delivery status callbacks. The fallback route exists and intentionally returns valid empty TwiML after recording no business mutation.
- Twilio Advanced Opt-Out is enabled. Custom opt-out, opt-in, and HELP keyword responses were saved; Twilio remains the sole sender of reserved-keyword confirmations so the application cannot double reply.
- The live application endpoints and Vercel variables are present, but disappearance of the Twilio save button was not treated as end-to-end evidence. Provider logs confirmed the configured URLs; a real handset acceptance sequence remains required.
- Toll-free verification remains in review. This blocks real delivery validation, not further local data-model or UI work.
- The Messaging Service validity period was observed as 36,000 seconds. No final change was confirmed, so production readiness requires an explicit retry-window decision and dashboard recheck.
- The final brand and custom domain are not selected. Every known URL, provider dashboard value, customer-facing message, secret-rotation check, acceptance test, and rollback step is inventoried in `docs/operations/domain-cutover.md`.

### Step 8 responsive/touch audit

Recorded on 2026-08-09.

- Public login, SMS consent, privacy, terms, support, and approval-link routes were exercised at a true 375px emulated touch viewport; no document-level horizontal overflow was found. The approval surface was also reviewed at tablet width.
- Owner planner inspection found four touch risks: lesson pointer-down could compete with page scrolling, compressed four-pixel teacher rails lacked a practical hit area, track expansion depended on hover, and phone day/month views retained desktop-density assumptions.
- The planner now starts in one-teacher day view on phones, preserves compact scope when rescheduling, uses expanded invisible touch hit areas for rails, toggles tracks on tap/keyboard, and limits initial touch dragging to the explicit reschedule handle.
- Phone month cells expose lesson counts and open a focused day; sheets use the viewport with reachable headers. Hover quick views remain optional enhancements only.
- Week view remains a deliberate horizontal schedule on narrow screens and is recorded as a future agenda/paged-day refinement, not hidden as an accidental overflow.

### Step 8 direction correction — email baseline and school-specific SMS

Recorded on 2026-08-11.

- Twilio rejected the initial toll-free verification with codes 30474, 30491, and 30477: missing/incorrect end-business identity, a login-protected website, and messaging consent that appeared transferable across businesses or programs.
- Audit conclusion: the earlier single MusicSchool Messaging Service assumption is not a valid production multi-tenant architecture. Twilio documents that an ISV should register the customer engaging with the recipient and that one toll-free sender cannot be shared across businesses.
- Product direction changed to included transactional email through Resend. Step 8 now exits on durable email delivery, verified provider reconciliation, replay safety, bounce/complaint suppression, request supersession, and successful approval acceptance.
- SMS moved to deferred Step 8A as a paid school add-on. Common Time will operate an approved parent ISV profile; each participating school requires an isolated subaccount, dedicated number, Messaging Service, end-business verification, immutable school-specific consent program, and scoped STOP/START/HELP state.
- Existing approval snapshots remain channel-independent. Existing SMS delivery, signature, callback, and consent code remains useful infrastructure but must be refactored away from global environment-only sender configuration before production school onboarding.
- Software tests do not require purchasing another number. A real US/Canada handset acceptance test does require one approved sender. The current rejected number can be assigned exclusively to the first school and resubmitted after its public compliance page and exact legal/business information are ready.
- Charge execution remains blocked by the revised email Step 8 exit gate, not by Twilio verification.

### Custom application-origin cutover checkpoint

Recorded on 2026-08-13.

- Vercel serves `app.commontime.studio` as the non-indexable application, `www.commontime.studio` as the indexable public Coming Soon surface, and permanently redirects the apex to `www`. The legacy Vercel hostname remains available and noindex for rollback.
- Supabase Site URL/callback configuration and an actual Google login returned successfully to `app.commontime.studio`.
- Production `APP_URL` was proven from server behavior rather than assumed from the Vercel dashboard: a Twilio request signed for the new callback URL passed signature verification to the expected account guard, while the same request signed for the old hostname failed signature verification.
- Stripe API inventory confirmed all three test event destinations use the new webhook URL. Platform and connected-account thin destinations passed genuine provider pings with durable, error-free ignored-event intake. The snapshot connected-payments secret passed a signed synthetic live-endpoint event and recorded it as ignored.
- The first platform ping was not immediately visible, so it was not counted as success; an isolated repeat produced durable intake. This preserved the rule that provider request acceptance alone is not webhook evidence.
- The legacy Twilio Messaging Service's incoming, fallback, and delivery callback URLs were updated through the API. Signed, non-keyword inbound and fallback probes returned valid empty TwiML without consent changes. Its validity period is confirmed at 3,600 seconds.
- Custom-domain cutover no longer blocks Step 8. Resend sending-domain authentication and the durable email delivery/reconciliation implementation are next.

### Step 8 email checkpoint — durable Resend foundation

Recorded on 2026-08-13.

- Preflight preserved the channel-independent approval snapshot as the payment-consent system of record. Email is a parallel delivery method; it does not redefine amount calculation, approval, collection, or receipt truth.
- Confirmed the configured Resend credential is send-only. The application calls the email API directly and adds only the maintained `svix` verifier dependency for signed raw-body webhook validation.
- Deployed durable email attempts before provider calls, stable provider idempotency keys, provider-response race reconciliation, append-only events keyed by `svix-id`, and timestamp-aware out-of-order handling.
- Permanent bounces, complaints, and provider suppression events create a global normalized-address suppression. A later owner send cannot silently bypass that safety state.
- Added owner/admin payer-email persistence and email-first approval controls. The message contains the exact period and amount plus a single-use 72-hour review link; approval remains explicitly separate from charging.
- The template has HTML and plain-text forms, escapes all school/payer content, and identifies the school through the visible sender name while using the authenticated Common Time subdomain.
- Migration `20260813120000` deployed successfully. Linked Supabase database lint reports no errors; generated types, TypeScript, and ESLint pass.
- Exit gate remains open: register the production Resend webhook, deploy its signing secret, exercise send/delivery/replay/out-of-order/bounce/suppression/supersession/approval acceptance, and confirm the owner sees reconciled truth.

### Step 8 email acceptance — first delivered approval

Recorded on 2026-08-14.

- Prepared and locked Julian Reed's August 2026 demo billing period with four immutable $55 per-session lines totaling $220. The initial draft correctly stopped on a past lesson missing an outcome; correcting that demo fact to completed allowed generation without fabricating a cancellation policy.
- Sent the first real approval email to the requested test payer address. The local attempt was created before submission, Resend accepted it, and distinct signed `email.sent` and `email.delivered` events reconciled the delivery to `delivered`.
- The approval request preserved exactly four lines and $220, remained `payment_status = not_started`, and the payer's hold-to-approve action recorded immutable amount/currency/period evidence. No Stripe payment attempt was created.
- Exit audit found that the legacy approval function advanced only the approval request while leaving its billing period `approval_pending`. Migration `20260814120000` now advances the matching period to `approved` inside the same transaction and reconciled the accepted test period. Database lint passed; the period is approved with no paid timestamp and no payment attempt.
- UI reorientation remains: email must read as the standard approval path; SMS must not appear as an equal always-available action and should be gated behind the per-school paid add-on configuration.
