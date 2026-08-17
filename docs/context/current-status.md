# Current Status

Production-domain URL, environment, provider-callback, verification, testing, and rollback changes are tracked in [`../operations/domain-cutover.md`](../operations/domain-cutover.md).

## Phase

Owner scheduling and family billing foundation are live in test mode. Payment roadmap Step 8 now delivers approval links by included transactional email; SMS has moved to an optional per-school add-on.

## Active Focus

1. Rehearse the newly deployed owner-adjustment, unlock/revise, payer rejection, and automatic-payment consent flows.
2. Keep the owner planner and payment surfaces reliable on phone, touch-only tablet, keyboard, and desktop.
3. Finish approval replacement, mandate safety checks, and email failure tests before implementing any Stripe charge execution.

## Provider State

- **Supabase:** linked and migrated; tenant, people, scheduling, billing, policy, approval, SMS-consent, and provider-event foundations are deployed with RLS and server authorization.
- **Vercel/domain:** `commontime.studio`, `www.commontime.studio`, and `app.commontime.studio` are valid on Vercel. Apex redirects to the indexable `www` Coming Soon page; `app` and the legacy application hostname are explicitly noindex. Production `APP_URL`, Supabase Site URL, Google/Supabase callback behavior, Stripe test destinations, and the legacy Twilio callbacks have passed the custom-domain cutover.
- **Google:** Google OAuth through Supabase is working locally and on the deployed app after correcting provider redirect configuration.
- **Stripe:** Connect is configured in test mode. The first school completed hosted onboarding; test card setup, attachment, detachment, Connect synchronization, and signed webhook intake have been exercised.
- **Transactional email:** `notifications.commontime.studio` is authenticated in Resend; its send-only key and webhook signing secret are configured locally/Vercel. The production webhook passed signature rejection and real `sent`/`delivered` reconciliation. One $220 approval email was delivered and accepted end to end. Replay, bounce/complaint suppression, provider failure, and supersession rehearsals remain.
- **Twilio:** the initial generic MusicSchool toll-free submission was rejected because it did not identify one end business, pointed reviewers into a login-protected app, and presented consent as reusable across schools/programs. The legacy service callbacks now use the custom app domain and its validity period is confirmed at 3,600 seconds, but the shared-sender implementation remains test foundation only; production SMS requires one isolated subaccount, number, verification, and consent program per add-on school.

## Implemented Product Foundation

- Lean Next.js App Router application with Supabase SSR, Google OAuth, school-scoped tenancy, role-aware authorization, and private avatar/logo storage.
- Owner School Setup for information, lessons/classes, spaces, versioned policies/documents, and staff.
- Demo school data with three teachers, 12 students, family/payer relationships, availability, recurring schedules, and varied lesson outcomes.
- Owner day/week/month planner, split availability, lesson details, structured places, single-lesson rescheduling, immutable change history, collision protection, and explicit reschedule permissions.
- Family billing accounts, immutable occurrence pricing, monthly draft generation, review blockers, three/four/five-week handling, fixed-monthly handling, and hold-to-lock review.
- Stripe Connect account state, hosted payer card setup, saved-method reconciliation, signed/idempotent provider-event intake, and disconnect handling.
- Expiring single-use approval requests bound to exact locked periods; public hold-to-approve flow remains separate from collection.
- Owner-entered charges/credits with required explanations, locked-but-unsent unlock-to-revise, email-first approval status, payer structured rejection/notes, and atomic request/period approval truth.
- Separate payer automatic-charge mandates with optional monthly cap, advance-statement notice, canonical evidence, supersession, and immediate revocation. Saving a card does not imply automatic collection.
- Public SMS enrollment, append-only consent evidence, durable delivery/status ledgers, owner approval-link send action, signed callbacks, inbound STOP/START/HELP synchronization, and provider-safe retry behavior.

## Current Gates And Known Gaps

- The current toll-free number is restricted and cannot complete a real US/Canada handset test. It can be assigned to the first school and resubmitted after school-specific business and public consent materials exist; no second number is needed merely to continue software testing.
- The Twilio parent account still needs an approved ISV Primary Customer Profile before production per-school onboarding. The legacy service uses an intentional 3,600-second validity period.
- No production or test charge-execution workflow is active yet. Approval, saved-card authorization, and collection remain deliberately separate.
- Submitted-but-pending proposals now have an owner `Revise and replace request` action that cancels the old bearer link atomically before reopening the statement; live recovery rehearsal remains.
- Automatic-payment enrollment/revocation is deployed but has not passed a live saved-card rehearsal. Long-lived payer access is still required so revocation remains available after an approval link expires.
- The first real school needs published cancellation/payment policies before months containing cancellations or no-shows can produce complete drafts.
- Teacher-only and guardian/student rescheduling flows are deferred. Their authorization and policy limits must not be inferred from the owner flow.
- Macro calendar closures and dated teacher exceptions are modeled but still need enforcement before client self-service rescheduling launches.
- Scheduling follow-up: add explicit occurrence-level substitute/change-teacher controls and standalone makeup/ad-hoc lesson creation. The data direction permits both; UI, authorization, optional makeup-origin linkage, and payroll attribution still need rehearsal.
- Phone day view defaults to one teacher and phone month view summarizes counts. Week view remains deliberately horizontally scrollable; an agenda or paged-day treatment is a future refinement.
- A paid Supabase backup plan and tested Storage export/restore procedure remain production-readiness requirements.

## Next Steps

1. Complete the live restart checklist below for adjustment, unlock, rejection/note, corrected replacement, saved-card auto-charge enrollment, cap, and revocation.
2. Rehearse owner `Revise and replace request`, then close Payment Step 8 only after replay, out-of-order event, bounce/complaint suppression, and supersession tests.
3. Add long-lived payer access for mandate review/revocation before any automatic collection.
4. Implement Stripe charge execution against an exact approved request or valid mandate with idempotency, receipts, refunds/disputes, and reconciliation.
5. Rehearse the planner/reschedule flow under a teacher-only account, then design policy-bound guardian/student access and magic-link delivery.
6. If the first school purchases SMS, create its fixed public consent/business page, assign the current toll-free number exclusively to it, and resubmit with exact end-business information.
7. Expand the `www.commontime.studio` Coming Soon page into the marketing/public-policy surface when launch content is ready.

## Next-Session Restart Checklist

1. Confirm Vercel serves commit `d65d425` or later.
2. Open **Garcia family · August 2026**. Live state at pause: locked at **$240**, consisting of four $55 lessons plus a **+$20** owner adjustment labeled `Billing correction · i charged too much last time`; no approval request exists.
3. Use **Unlock to revise**. Verify all five lines remain, remove or correct the adjustment, add a negative credit, refresh the draft, and confirm the adjustment survives before relocking.
4. Give the Garcia payer a reachable test email, send an approval proposal, and reject it as `missing_credit` with a note. Verify the exact link becomes rejected, the period returns untouched to review, and the owner sees the reason/note.
5. Correct the Garcia statement, relock, and send a new version. Verify the rejected token remains unusable and only the replacement can be approved.
6. Use **Open secure Stripe setup** for Garcia with a Stripe test card. After approval, exercise automatic-payment enrollment with a cap and notice window, confirm the mandate in Supabase, then revoke it and verify append-only events.
7. Do not implement or simulate a charge during these rehearsals. Charge execution remains a later gated step.

## Updated

2026-08-14
## 2026-08-15 pause — approval rejection and billing timing

- Garcia family August 2026 version 2 is approved at $200. Approval did not create a Stripe charge. Preserve it as successful approval evidence.
- Functional defect: the payer rejection/request-adjustment UI remains visible after approval. Render payer decision controls only while the exact request is pending. Later disputes use a separate contact/correction/credit/refund workflow.
- Rejection testing moves to Kim family. Daniel Kim's payer email is `elscarpo@gmail.com`; no August billing period exists because preparation safely stopped on the unresolved August 13 lesson.
- Before resuming that test, implement guarded and audited lesson-outcome entry for owners/admins and the assigned teacher.
- First add billing timing: school default before-service vs after-service, optional offering override, resolved immutable lesson-agreement snapshot, and separate billing-day/review-deadline/charge-date settings. The present generator implicitly behaves as after-service and must not remain the only mode.
- Then prepare and lock Kim August, send a new email request, choose `Something looks wrong with these charges`, submit `A credit or discount is missing` through `Send back for review`, verify owner evidence, replace the request, and prove the rejected token is unusable.
- Financial-ledger requirement added: support durable one-off charges, statement-only adjustments, persistent family account credits, credit reservation/application/release, payments, provider refunds, reversals, and write-offs. A refund returns settled money; a stored credit remains available for later statements. All are append-only/compensating and fully auditable.
- Receipt requirement added: index receipts in family and relevant student histories using durable local payment allocations and Stripe object IDs. Fetch the connected account's current Stripe-hosted `receipt_url` only when an authorized user requests it because hosted links expire. Multi-student payments remain one family receipt with per-student allocation context.
- Regular audit program planned in `docs/context/audit-program.md`: security/tenancy, financial reconciliation, workflow/state machines, provider APIs/webhooks, error recovery, database integrity, UI/accessibility/responsiveness, performance/dependencies, privacy/communications, and operational readiness. It defines per-change, pre-deploy, milestone, monthly, quarterly, and cutover gates plus evidence and severity standards.
- Failed-charge recovery requirement added: durable declined/failed attempts, deduplicated owner alerts, an action-needed queue, safe retry only when authorized, request-new-method flow, payer re-review when amounts change, cash/manual settlement, credit application, follow-up, and explicit write-off. Stripe failure never becomes `paid`, and retries never silently loop.
- Bulk billing requirement added: idempotently prepare a month across families with per-family transactions/results, then open a review queue. Reviewing individual drafts is primary. A visually secondary bulk-lock path opens an exception summary and deliberate confirmation; bulk preparation/locking never sends approval requests or charges anyone.
- Explicit billing timing deployed on 2026-08-17: ScarpsSchool and all existing occurrence snapshots are before-service; school defaults and offering overrides now feed immutable agreement/event snapshots. Before-service scheduled lessons draft without outcomes, while after-service periods wait for completed service facts. Rollback-only branch verification passed; owner settings are in Lesson and Class configuration.
- Kim rejection rehearsal passed: $160 before-service draft, lock, delivered approval email, payer rejection for missing credit with exact note, rejected-token state, editable owner review, and visible owner reason/note. No payment started. Next: add a statement credit, relock/send a replacement, and prove the rejected link remains unusable.
- Owner response notifications are required: durable database notification plus in-app inbox/toast and transactional email at minimum; SMS is a paid-add-on enhancement. Response truth and notification delivery are separate, retryable records.
- Kim replacement request is live: rejected version 1 remains $160; pending version 2 is $150 and has a distinct token. Old-link UX should say the statement was updated and direct the payer to their newest message without exposing or redirecting to the new token.
- Kim replacement is now approved: version 1 remains rejected at $160, version 2 is approved at $150, the period is approved/unpaid, and no payment attempt exists. The manual approval revision chain has passed end to end.
- Approval request scalability is now database-enforced: unique period/version and one pending request per period. Rejection deactivates its URL immediately, regardless of whether a replacement is ever created. Old pages know only whether a newer version exists and provide terminal, non-redirecting guidance without exposing the replacement token.
- Owner payer-response notifications are deployed at the database layer and implemented in the app: transactional durable owner/admin notices plus email outbox, recipient-only inbox, live toast, independent Resend submission, and webhook reconciliation. Rollback fan-out/deduplication passed. Next live payer response must verify toast, inbox, email delivery, and failure isolation; retry scheduling remains pending.
