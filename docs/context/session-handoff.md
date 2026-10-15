# Active Session Handoff

Updated 2026-10-13 after automatic saved-card settlement passed and flexible invoice batching entered staging verification. This file is the quickest restart point after a lost conversation; the authoritative launch gates remain in [`../operations/production-readiness-plan.md`](../operations/production-readiness-plan.md).

## Restart rule

- Read this file before proposing the next payment test. Do not infer progress from old chat context.
- After every implemented, deployed, or human-tested payment step, update this handoff and append evidence to [`../audits/payment-roadmap-audit-log.md`](../audits/payment-roadmap-audit-log.md) before calling the step complete.
- Keep `implemented`, `deployed`, `provider-configured`, and `live-tested` distinct. A successful provider mutation is not webhook acceptance, and a successful UI render is not a money-state test.

## Current branch and deployment

- Working baseline: protected `staging` branch at merge commit `61db86a` (PR #73) or later.
- Persistent staging uses the isolated Supabase staging branch and the `Common Time Staging` Stripe sandbox. Vercel Preview variables for branch `staging` point to those systems; Production variables remain Production-only.
- On 2026-10-13, merging the long-lived staging-to-main PR deleted the former Supabase preview branch because its actual control-plane setting was ephemeral despite the repository describing it as persistent. Self-service restoration returned `Preview branch not found`. Replacement branch `iubmheectmsoavztbzma` was created explicitly with `persistent: true` and `with_data: false`; never reuse former ref `plnluybazyltxtsbkxpn`.
- Never copy secret values into documentation. Relevant variable names and rotation procedures are in [`../operations/staging-environment.md`](../operations/staging-environment.md).
- Preserve unrelated local untracked files. At this checkpoint they include an August screenshot, `docs/fromanotheragent.md`, `docs/ig screenshots_for WINS/`, `icon-test.png`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`.

## Stripe Connect result

- The staging school completed Stripe-hosted Accounts v2 onboarding in test mode.
- A deliberately invalid/failing test identity value exercised the real failure path: Stripe requested identity correction/document verification, Common Time synchronized the requirement, and the Payments page changed from review to `Action required` without enabling money movement.
- The owner returned to hosted onboarding, skipped the document scan, edited the identity number to Stripe's successful test value, and completed onboarding without supplying real SSN or ID data.
- Stripe then reported `details_submitted = true`, `charges_enabled = true`, and `payouts_enabled = true`. Common Time displayed the ready state after the page refreshed, demonstrating that the onboarding return/account-update synchronization path works.
- Do not use real identity documents, SSNs, cards, or bank accounts in the sandbox. Use Stripe's documented test values only.

## Payment-status UI now deployed to staging

- PR #42 distinguishes not connected, setup in progress, under review, action required, not approved, and ready states.
- Under review shows a clear `Payment account is in review` heading, `Awaiting approval` badge, submitted/payments/payouts explanations, and one `Check status` action. Raw repeated unknown Stripe requirements are collapsed into one safe task.
- Rejected accounts are told that integrated payments are unavailable while scheduling, attendance, family records, and manual billing remain usable.
- PR #44 adds one shared `useFormStatus` button component. Onboarding and status buttons disable immediately, show a spinner, and use `Connecting to Stripe…`, `Opening Stripe…`, or `Checking status…` labels to prevent repeat clicks while server actions or redirects run.
- Local typecheck, lint, and production build passed for PR #44; protected CI `verify`, `database`, and `browser` checks plus Vercel passed before merge.

## Stripe webhook state

- The staging Stripe destinations use the Vercel automation bypass plus independent Stripe signature verification. Signed intake has returned HTTP 200 and persisted durable provider events.
- The handler accepts classic `account.updated` and Accounts v2 `v2.core.account.updated`/related account events, resolves the durable school connection, re-retrieves the account from Stripe, and persists current requirements/capabilities.
- The database can therefore update automatically when Stripe changes account status. An already-open browser page is not live-subscribed; it must refresh/reopen or use `Check status` to display the stored update.

## Approved-statement collection checkpoint

- The earlier payer-present $1.00 hosted lesson Checkout passed on 2026-09-29. Do not repeat it as the next test; its remaining failure-matrix rows are still open separately.
- PR #69 deployed family payment-method management: up to three active methods, explicit default selection, and a smaller add-another-method surface. PR #70 refined the hold-to-remove control.
- PR #71 deployed owner-initiated collection for an exact approved billing period. It creates a durable attempt before Stripe, uses one stable idempotency key, prevents an open/succeeded duplicate for the period, charges the connected school account off-session, and refuses to mark success from the immediate API response.
- Signed `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.processing`, and `payment_intent.requires_action` events re-retrieve and bind the PaymentIntent to the exact local school, family, period, amount, currency, connected account, Customer, and PaymentMethod before updating the statement.
- On 2026-10-09, the synthetic staging family referred to during testing as `TestFamily` submitted one exact approved $2.00 statement using the saved `4242` test card. Stripe created a succeeded test-mode PaymentIntent and Charge on the correct connected account.
- The staging endpoint had not yet subscribed to PaymentIntent event types. Common Time therefore remained at `Payment submitted — awaiting confirmation` and did not offer a duplicate charge. The missing subscription was diagnosed, the four required PaymentIntent event types were enabled on the staging endpoint, the succeeded intent was authoritatively re-read, and the local attempt/period were manually reconciled to `succeeded`/`paid`.
- This first $2.00 run proves charge submission, provider binding, durable duplicate prevention, and fail-closed missing-webhook behavior. It does **not** prove automatic PaymentIntent webhook settlement after the subscription correction.
- PR #72 visually de-emphasizes paid statement cards. PR #73 keeps recent paid statements in the main history and presents paid statements whose service-period end is more than six school-calendar months old through `View archived invoices`; this is presentation-only and never changes ledger status. The archive UI has automated date-boundary/build coverage but no live old-invoice fixture yet.

## Immediate next tests

Do not redo card setup or either successful $2.00 charge. Automatic signed-webhook settlement passed on replacement staging.

1. Visually accept the new finder placement/sizing and invoice-preparation modal on staging.
2. Create fresh synthetic lesson charges, remove one from the first draft, lock the remaining invoice, and prove the deferred lesson alone appears on a later invoice for the same service month. Confirm no locked source can appear twice and that remove/defer is not presented as waiver or credit.
3. Rehearse the payer lesson-cancellation request end to end again: payer access and submission, owner visibility/decision, calendar result, accounting disposition, notification, and any resulting invoice/credit behavior. Record every outcome; do not assume the earlier cancellation work still passes after invoice batching.
4. After the UI/billing/cancellation pass, resume the saved-card failure matrix with a controlled decline, followed by authentication-required, duplicate/concurrent submission, and unknown-outcome recovery.

### Replacement October staging fixture

- The 2026-10-12 fixtures and all former staging Auth/database records were deleted with ephemeral branch `plnluybazyltxtsbkxpn` on 2026-10-13. Their IDs are historical only and must never be used as current evidence.
- Persistent, data-less replacement branch `iubmheectmsoavztbzma` contains synthetic school `fc760892-4b3a-4602-9931-0715c2a033fc`, billing account `fa7602df-dcaa-46fa-9af4-fcc68b97e50e` named `TestFamily`, owner login `scarpelli.jon@gmail.com`, payer login `elscarpo@gmail.com`, and student `Test Student` with primary teacher `JONATHAN ME`. These identities are deliberately separate.
- Two new one-time lessons use `Staging Checkout Test – 30 min` at $1.00 and `TestPlaceA`: October 19 and October 26, 2026 at 10:00–10:30 AM America/Chicago. Their insert triggers created new immutable price snapshots.
- The former saved payment method, billing period, payment attempt, and webhook evidence were not recoverable. Do not claim the replacement fixture has a saved card or approved statement.
- On 2026-10-13, the owner signed into replacement staging and confirmed School Settings → Payments retained the prior Stripe test-account details and reports the connection as enabled. The owner then completed assisted setup for TestFamily and confirmed that a `4242` Stripe test payment method appears on file. Provider and saved-method recovery are complete; do not repeat either setup. The next action is to prepare the fresh October statement from the two $1.00 lessons before resuming automatic-webhook acceptance.
- The owner prepared TestFamily's October 2026 invoice with both replacement $1.00 lesson lines, confirmed the exact $2.00 total, locked it, emailed payer approval, and collected exactly once after payer `elscarpo@gmail.com` approved. The UI moved from `Payment submitted — awaiting confirmation` to a subdued `Paid` card. Backend evidence confirms period `c8d584c2-f181-429d-9054-15018e4e4d73` and attempt `949d0ffe-eda7-441e-b936-d9245a1617b6` are paid/succeeded; test-mode PaymentIntent `pi_3UQDQpPxyWsGAVln2U6MN9C5`, Charge `ch_3UQDQpPxyWsGAVln2tQsLDig`, and first-attempt processed event `evt_3UQDQpPxyWsGAVln2J21rYUp` match exact 200 USD cents on connected account `acct_1UQCmbPxyWsGAVln`. Automatic signed-webhook settlement passes with no manual reconciliation. Do not repeat this invoice or charge.

### Replacement scheduling-only staging fixtures

- Replacement staging contains teachers Maya Chen, Elena Rodriguez, Marcus Bennett, Jerry Seinfeld, and JONATHAN ME, each with two recurring availability blocks.
- Scheduling-only students are Sophie Walsh, Liam Brooks, Ava Patel, Noah Williams, Emma Thompson, and Lucas Martin. They have **zero billing-account links**.
- Six filler lessons plus the two TestFamily lessons populate October 14–26. Payment acceptance remains exclusively `JONATHAN ME` + `Test Student` + `TestFamily`/`elscarpo@gmail.com`.

### Lesson finder availability windows

- The finder now presents each teacher's continuous free windows rather than generating 15-minute or lesson-duration start increments.
- Selecting an offering does not remove shorter openings. A window that cannot fit the selected duration remains visible but muted and cannot be selected; its label explains that it is too short, allowing the owner to reconsider the lesson length.
- Past days are omitted consistently, and today's first open window is clipped to the scheduling minimum whether or not an offering is selected.
- The large standalone finder remains only on the main dashboard. Directory and student/family/teacher record copies were removed; the former `New lesson` action in the shared school header is now `Find an opening` with a magnifying-glass icon and opens the real finder modal from every owner page.
- Header finder context follows the route: student records constrain the student, family records constrain students to that family, and teacher records constrain the teacher. Beneath the finder explanation, `Or you can manually + Add a lesson` opens the ordinary composer without requiring availability selection.

### Direct calendar lesson entry

- Week/day planner calendars now expose a subtle five-minute hover time and open the lesson modal directly when an empty point is clicked; the separate Add lesson button remains a straightforward manual-entry affordance.
- A click inside a teacher-specific availability track carries that teacher into the modal. Teacher-record calendars always carry their teacher. Month calendars carry only the clicked date, intentionally leaving time unset.
- Student records now have an explicit `primary_teacher_id` scheduling default. Existing students are backfilled from their latest active series or lesson; selecting a student in lesson creation fills that teacher unless a teacher-specific calendar context already supplied one. Individual lessons may still override it.
- The modal greys out five-minute choices that would overlap the selected teacher's lessons. If an owner chose the time first and a later teacher, date, student, or offering choice makes it conflict, the time is cleared with both an inline danger message and a toast.

## Owner navigation checkpoint

- The calendar interaction rule is now consistent for owners: create a lesson in place from the calendar currently being viewed. The overall calendar can schedule any student, a family calendar limits the picker to that family, and a student calendar fixes the student. Record-level creation opens over the current page rather than navigating away.
- The owner Students and Families navigation labels still open their full list pages. Hover, keyboard focus, or the adjacent disclosure control opens a scrollable quick directory with search and direct record links.
- The quick-directory hover bridge has no dead gap; its panel is slightly smaller and uses a higher-contrast raised background.
- The Staff label now has the same quick directory, populated with active people who have teacher records; clicking Staff itself still opens the full staff page.
- A staging regression where record-calendar Add lesson clicks appeared inert was traced to dialog CSS being bundled only with the main planner. The creation dialog now owns its overlay CSS module, so student/family calendar creation does not depend on the planner bundle.
- Both full directory pages now have a simple search. Students match student, family, or teacher; families match family name, payer name, email, or phone.
- This work changes navigation and form defaults only. It does not change billing, approval, collection, webhook, or ledger behavior.
- The synthetic lessons now exist. Immediate human action is to prepare and approve the new October statement, then perform the automatic invoice webhook settlement test above. Do not recreate the lessons, repeat payer/card setup, or repeat the already-reconciled first $2.00 charge.

## Lesson-composer direction agreed in discussion

- Weekly lessons should default to an ongoing series, not a twelve-week series with a silent hard stop. Materialized calendar occurrences should cover the remainder of the current month plus the next two complete calendar months. Automatic maintenance should add the next full month as the horizon advances so every active series remains at least two full months ahead. A series may instead have an explicit end date, and one-time lessons remain supported. The horizon may become a school setting later, but should initially use this single predictable default.
- Series intent and generated occurrences must remain separate: the ongoing series is the source of truth; a bounded rolling set of lesson events supports calendar, conflicts, and billing. Maintenance must be idempotent, preserve occurrence exceptions, never recreate cancelled/rescheduled lessons, and surface generation conflicts rather than silently shortening the schedule.
- Model an explicit primary-teacher relationship for each student. Selecting a student defaults the lesson teacher from that relationship, while an individual lesson may override it.
- Service type/duration must be known before availability suggestions can be accurate. The intended helper supports either direction: choose service/student and see fitting openings, or ask for a desired time and see which teacher/service durations fit.
- Teacher or student overlaps are not allowed. Outside regular availability may remain an explicit warned exception, but overlap is a hard conflict.
- Week/day calendars enter focused add mode and let the owner choose an empty slot; month view goes directly to a compact composer because it cannot express time placement precisely.
- Quick student creation returns to the unfinished lesson. It does not send payment-method verification; payment setup remains a separate owner decision.
- The shared `Find an opening` panel above owner, student, and family calendars now behaves as a weekly filter board. Any first filter reveals matching possibilities; teacher-only shows that teacher’s free blocks, and adding an offered service converts them to 15-minute start choices that fit the full duration. Day/time filters narrow the same week, occupied teacher time and known-student conflicts are removed, and previous/next week preserves all filters.
- Selecting a result carries teacher, service, date, and time into the existing lesson composer. This is the availability foundation, not the final unified composer: explicit primary-teacher persistence/defaulting, quick student creation/resume, focused week masking, and month-cell entry remain follow-up work.

## Decisions and open work

### Empty-invoice refusal and global invoice entry — 2026-10-14

- During flexible-batching acceptance, the owner intentionally prepared November 2026 before creating any lessons. The old draft RPC persisted an empty TestFamily invoice, exposing a real invalid-state bug.
- Staging draft `838e19e5-7aae-4d3b-9994-b8b7e075235d` was identified by exact school, billing account, month, draft status, zero amount, and absence of lines, then removed by a narrowly guarded migration. Read-back confirms it no longer exists.
- Invoice preparation now raises `no_unbilled_items_for_month` after draft population finds no lines. Because the exception occurs in the same database transaction, the new period and all population side effects roll back; the owner sees that there are no unpaid items and no invoice is created.
- The full service-month input opens its native month chooser when clicked, rather than requiring a click on the small calendar icon.
- The dashboard now has a fourth large `Prepare an invoice` action. The shared owner header also has a compact `Prepare invoice` action next to `Find an opening`. Both open a searchable payer chooser that matches family/payer names and connected student names, then opens the existing month/review flow on the correct payer account.
- Staging migration, typecheck, lint, production build, and six browser smoke tests pass. The next human action remains: create fresh TestFamily lessons, prepare the intended invoice, remove/defer one line, and finish the flexible-batching acceptance before repeating the payer cancellation-request flow.

### Invoice preparation workspace and queue — 2026-10-14

- The shared header/dashboard invoice launcher no longer navigates away after payer selection. It prepares within the modal and keeps truthful success, no-items, and error feedback visible.
- A successfully prepared invoice is immediately shown with family, service month, exact total, status, and every line. The existing hold-to-lock boundary remains mandatory; after locking, the same modal can email the payer approval request. `Prepare another invoice` returns to payer/student search without discarding the session's prepared-invoice carousel.
- The header Invoices menu is now a 20-most-recent invoice command queue. Draft/review invoices are explicitly labeled `Not locked`; locked invoices are labeled `Locked · approval not sent`. Each row shows family, month, line count, total, and status.
- Queue controls can select all invoices needing lock or all invoices ready to send. Bulk locking and bulk email delivery are separate hold-to-confirm operations; preparation never silently locks or contacts payers. Per-invoice navigation and individual approval sending remain available.
- This interface reuses the existing server-enforced lock and approval-email actions. Bulk operations process each invoice through those same authorization, state, amount, recipient, delivery, and idempotency boundaries rather than adding a bypass.
- Follow-up correction removed the legacy family-page `?period=` navigation after preparation. Both family-page and global launcher flows now keep the page stationary and render the prepared invoice inside the modal. The modal shows its live lines/total, embeds charge/credit/outstanding-lesson adjustments, refreshes the invoice after an adjustment, supports hold-to-lock, and can return to preparation without closing.

### Modular editable invoices — 2026-10-14

- `Adjust this amount` is now `Adjust this invoice` with three explicit paths: add a manual charge, add a credit, or add an eligible unpaid lesson. Month-based automatic preparation remains the primary workflow.
- The lesson picker shows only per-session lessons connected to that payer that currently resolve to a positive charge and are not separately paid, already present on a non-void invoice, or reserved by a locked/later invoice. Fixed-monthly occurrences remain series-billed and are intentionally excluded.
- Adding a lesson rechecks every eligibility condition inside the database transaction, uses its immutable price snapshot, service date, billing timing, and policy disposition, and records an audit event. The owner cannot type or alter its amount through this path.
- Selecting an invoice from the header queue now opens its details and scrolls that exact invoice into the center of the family page.
- Draft/review and Paid labels are now prominent bordered status pills in dashboard invoice lists and family invoice cards. Paid cards remain visually subdued through their surface treatment, but no longer use parent opacity that also washed out the status label.
- The header invoice queue now uses the same high-contrast badge treatment for `Not locked`, `Locked · approval not sent`, Paid, and later lifecycle states.
- Browser acceptance: the owner removed one November TestFamily lesson from the first November draft, locked the retained invoice, prepared another November invoice that contained only the still-unpaid deferred lesson, and successfully added that lesson to the later invoice. Deferred-source recovery and exclusion of the already-locked source pass. The later invoice still needs to be locked, after which duplicate-source refusal should be confirmed before approvals are sent.
- Follow-up acceptance: the later November invoice locked successfully. A third November preparation attempt then returned the expected no-unpaid-items result and created no invoice. Both lessons are therefore reserved exactly once across the two locked invoices; same-month flexible batching, deferred recovery, and duplicate-source protection pass end to end.
- Deferred UI follow-up: invoice-queue checkboxes currently allow a mixed-status selection even though each action handles only one lifecycle transition. A later pass must constrain, split, or clearly summarize mixed selections. Do not conflate this UI issue with the verified database transition guards.
- Bulk approval-email acceptance passed with the two locked TestFamily November invoices. The browser submitted them sequentially and both completed successfully. The first invoice remained open while the other was collapsed, confirming that invoice presentation state is independent of delivery success.
- The payer inbox at `elscarpo@gmail.com` subsequently received both approval emails. Bulk delivery therefore passes through real inbox arrival for both invoices; neither arrival alone constitutes payer approval.
- The payer opened both separate November requests: one was approved, while the other was returned for review with the reason that a credit was missing. This establishes independent payer decisions after a bulk send. The approved invoice may become collectible; the rejected invoice must return to editable review and remain unchargeable. No collection was authorized by this checkpoint.
- Owner-side visual acceptance passed: the two invoices independently appear as one in review and one approved. Bulk delivery and mixed payer decisions did not merge or cross-contaminate their lifecycle states. The approved invoice remains unpaid and must not be collected before the cancellation regression.
- Payer-portal OTP initially failed on replacement staging. A direct request to `iubmheectmsoavztbzma/auth/v1/otp` returned `500 Error sending magic link email`. The branch had inherited the Resend SMTP host, sender, and numeric `{{ .Token }}` template, but Supabase branching had replaced the SMTP password with a placeholder. The staging-only Resend SMTP credential was restored through the Supabase Auth configuration API; production was untouched. A subsequent direct OTP request for `elscarpo@gmail.com` returned HTTP 200. Inbox receipt and portal entry remain the next human confirmation.
- The repaired staging OTP email then arrived in the real `elscarpo@gmail.com` inbox. SMTP submission and real delivery now pass; entering the newest code and loading the authorized TestFamily portal remain the final authentication checks.
- Staging payer-session configuration was inspected after OTP delivery. Access JWTs expire after 3,600 seconds and refresh-token rotation is enabled, but both the absolute session timebox and inactivity timeout are disabled. A payer therefore remains signed in through silent refresh and browser restarts until explicit sign-out, cookie/site-data removal, or server-side revocation. Portal UX follow-up: replace the ambiguous authenticated-state label `Use a different email` with an explicit `Sign out` action, and include persistent Privacy, Terms, and an accurate data-handling/account-help link or section on the payer portal. Decide and document an inactivity/absolute lifetime before real-family launch rather than leaving persistence accidental.
- Cancellation regression failed at preview: the payer opened a future TestFamily lesson and saw `This request cannot be prepared. Contact the school for help.` with no cancellation/reschedule actions. Read-only staging inspection found no published cancellation policy for Common Time Staging School. The database correctly refuses to infer financial/scheduling consequences without a policy, but the portal incorrectly hides the actionable `published_cancellation_policy_required` cause behind a generic error. No request, lesson mutation, invoice change, or payment attempt occurred. Next: explicitly choose and publish the staging test policy, improve this error state, then repeat against the approved-but-unpaid lesson.
- The portal now maps `published_cancellation_policy_required` to an explicit explanation that lesson changes are unavailable until the school publishes its cancellation policy. The approved-but-unpaid target is Test Student's November 23, 2026 12:20 AM America/Chicago lesson (`971e6db1-a1c6-4db7-bbb9-d633bf1efa35`), on approved $1.00 invoice `9fb27d17-13ca-4061-b578-6ea21bd0c93a`. The November 30 lesson belongs to the separate invoice in review and is not this test's target.
- Payer lesson details now surface the school's public reply email and phone as tap-to-email/tap-to-call links when a policy error tells the payer to contact the school, and alongside any policy state where refunds are handled directly. The authorized portal lesson RPC exposes only those School Settings fields after the existing payer/family/lesson authorization; it does not expose owner or staff records. Common Time Staging School currently has neither field configured, so the portal truthfully says public contact details have not been provided until the owner fills them in.
- At the owner's explicit direction, Common Time Staging School published synthetic cancellation-policy version `ca1dee32-de6f-406b-bec7-b28b126362e8`: 24-hour cancellation/reschedule notice; timely cancellation waives the lesson charge; late cancellation normally counts as serviced with no replacement or fee; replacement window 90 days where applicable; assigned teacher retained. Family access requires owner review for timely changes and directs refund questions to the school. A rollback-only payer preview of the exact November 23 approved-but-unpaid lesson now succeeds with `within_policy_window=true`, `accounting_state=approved`, `policy_disposition=waive`, and `approval_mode=owner_review`. No cancellation request or mutation was created by verification.
- Browser review exposed misleading accounting language: the approved-but-unpaid lesson was labeled `Cancel and request account credit` and showed refund guidance even though no payment had occurred. The lesson-change panel now displays a prominent accounting badge and explanation for `Not yet invoiced`, `Draft invoice`, `Invoiced · approval pending`, `Approved · not paid`, or `Paid`. Locked/approved unpaid lessons use `Cancel and request billing correction`; refund guidance is rendered only for paid lessons. No fake refund-request button was added because the recorded refund-request/execution workflow is not implemented.
- Product clarification simplified the payer choice: any lesson already on an invoice—draft, locked, approved, or paid—offers `Cancel and request account credit`; only a never-invoiced lesson offers plain cancellation. The accounting badge supplies the precise state. Unpaid states explicitly say no refund is involved, while refund guidance remains paid-only. The short-lived `billing correction` wording was removed because payers should not need to reason about internal invoice mechanics.
- Final payer-facing simplification removes accounting choices from lesson intent entirely. The two actions are always `Reschedule this lesson` and `Cancel this lesson`; the accounting badge remains informational. Copy says the displayed policy will be applied and warmly invites the payer to contact the school to discuss another option. Credit, invoice adjustment, refund, waiver, and charge mechanics belong to policy/owner resolution, not the payer's initial request.
- Payer-portal language assumes families will not remember prior billing actions and must not imply that they need to initiate payment. The approved-uncollected lesson badge therefore says `You approved these charges`; its explanation says the school has not charged the saved payment method yet and there is nothing else the payer needs to do. This microcopy change is intentionally left for the next grouped commit/push.
- Cancellation regression submission exposed a duplicate-active-request defect. The payer submitted cancellation for lesson `971e6db1-a1c6-4db7-bbb9-d633bf1efa35`, closed and reopened the drawer, then was incorrectly allowed to submit a contradictory reschedule; the owner active queue showed both. Migration `20261015150000_one_active_lesson_change_request.sql` now enforces one pending/in-progress request per lesson rather than one per scenario, preserves the earliest request when cleaning duplicates, and returns that pending request in the payer lesson RPC. The portal now renders the recorded pending state after reopen and suppresses further actions; a concurrent second submission also fails on the database constraint. Persistent staging read-back confirms cancellation `c92094e9-498f-416b-8a28-aa3f303d827d` remains pending and reschedule `01836913-3487-4147-95aa-962092cb1dbc` is superseded, so only the cancellation remains in the owner's active queue.
- Deployment incident: the local Supabase CLI remained linked to production despite the repository's staging remote configuration, so the new migration was initially applied to production. The mistake was detected immediately. Production contained no duplicate active requests and therefore no request rows changed; the schema/function and migration-history entry were restored to their exact prior state and verified (`old_index_present=true`, `new_index_present=false`, pending portal fields absent, contact fields retained). The migration was then applied directly to exact project ref `iubmheectmsoavztbzma` through the Management API and verified there. Do not use an unqualified `supabase db push` for staging; resolve and verify the actual linked project immediately before any database write.
- Bulk sending now shows per-invoice `Waiting`, `Sending`, `Sent`, or `Failed` progress. It no longer refreshes, redirects, or scrolls the surrounding page after the batch; this is required because a future batch may span unrelated payers.
- The current sequential browser orchestration is acceptable only for the small staging test. Near-term production work must replace it with a durable server-side queue/outbox batch that records per-invoice jobs, supports bounded concurrency, idempotent retry, backoff, resume after browser exit, and observable batch progress.

### Approval-by-email-reply follow-up

- Add an optional one-invoice approval path where the payer replies `APPROVE` to the approval email. It must remain exact-invoice authority, not a standing mandate: unique opaque reply address, sender match to payer email, original Message-ID/thread correlation, signed/idempotent inbound webhook processing, unambiguous command parsing, expiry/supersession/state checks, durable evidence, and a confirmation response.
- Any ambiguous reply, different sender, forward, automated response, expired/replaced request, changed statement, or non-`APPROVE` content must fail closed. A `REVIEW` reply may route the payer to the existing review experience. Consent language needs review before this becomes charging authority.

- Flexible invoice batching is implemented and migrated on replacement staging but still needs browser acceptance. Preparing gathers unpaid eligible sources; removing a source records a draft-specific deferral rather than a waiver/credit; locked invoices reserve sources against duplicate billing; unlocking/review or voiding releases reservations; and later invoices may cover deferred lessons from the same service month.
- Integrated payments remain optional. The plan now requires a durable, reversible school opt-out that suppresses prompts without deleting provider evidence and allows later reconnection.
- Provider review, remediable action, rejection, and voluntary opt-out must remain separate states. Payment failure must never block unrelated school operations.
- Before adding Square or support for an existing external Stripe workflow, define a provider-neutral connection boundary; no such alternate integration is currently promised.
- A future capability-gated platform-admin operations view must show safe connection stage, charges/payouts availability, requirement category, last sync, stale-state warning, connected-account link, and recent sync/webhook failures. It may offer an audited refresh but must never expose identity numbers, bank details, verification documents, credentials, or raw provider payloads, and staff must not complete owner verification.
- Change Stripe platform branding from the personal fallback to Common Time before beta invitations/live onboarding.
- The product remains suitable only for a supervised synthetic-data beta. It is not ready for real family imports, live money, production SMS, or unattended production use; remaining gates include the live payment matrix, multi-role browser acceptance, monitoring, secret scanning, backup/restore rehearsal, and broader security/operations work.

## Recent merged work

- PR #36: webhook claim/replay database coverage.
- PR #37: one-time-payment tenant metadata and connected-account binding hardening.
- PR #38: payment rejection matrix documentation.
- PR #39: durable staging Auth URL configuration.
- PR #40: narrow service-role Stripe connection-sync grants and browser mutation revokes.
- PR #41: pre-beta Stripe platform-branding requirement.
- PR #42: human-readable Stripe connection states and state-classification tests.
- PR #43: platform-admin payment setup visibility requirement.
- PR #44: pending/disabled UI states for Stripe onboarding and status actions.
