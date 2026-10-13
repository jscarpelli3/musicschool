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

- Model an explicit primary-teacher relationship for each student. Selecting a student defaults the lesson teacher from that relationship, while an individual lesson may override it.
- Service type/duration must be known before availability suggestions can be accurate. The intended helper supports either direction: choose service/student and see fitting openings, or ask for a desired time and see which teacher/service durations fit.
- Teacher or student overlaps are not allowed. Outside regular availability may remain an explicit warned exception, but overlap is a hard conflict.
- Week/day calendars enter focused add mode and let the owner choose an empty slot; month view goes directly to a compact composer because it cannot express time placement precisely.
- Quick student creation returns to the unfinished lesson. It does not send payment-method verification; payment setup remains a separate owner decision.
- The shared `Find an opening` panel above owner, student, and family calendars now behaves as a weekly filter board. Any first filter reveals matching possibilities; teacher-only shows that teacher’s free blocks, and adding an offered service converts them to 15-minute start choices that fit the full duration. Day/time filters narrow the same week, occupied teacher time and known-student conflicts are removed, and previous/next week preserves all filters.
- Selecting a result carries teacher, service, date, and time into the existing lesson composer. This is the availability foundation, not the final unified composer: explicit primary-teacher persistence/defaulting, quick student creation/resume, focused week masking, and month-cell entry remain follow-up work.

## Decisions and open work

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
