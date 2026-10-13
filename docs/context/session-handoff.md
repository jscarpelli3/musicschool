# Active Session Handoff

Updated 2026-10-12 after adding owner navigation and contextual lesson-entry improvements for the next automatic-settlement test. This file is the quickest restart point after a lost conversation; the authoritative launch gates remain in [`../operations/production-readiness-plan.md`](../operations/production-readiness-plan.md).

## Restart rule

- Read this file before proposing the next payment test. Do not infer progress from old chat context.
- After every implemented, deployed, or human-tested payment step, update this handoff and append evidence to [`../audits/payment-roadmap-audit-log.md`](../audits/payment-roadmap-audit-log.md) before calling the step complete.
- Keep `implemented`, `deployed`, `provider-configured`, and `live-tested` distinct. A successful provider mutation is not webhook acceptance, and a successful UI render is not a money-state test.

## Current branch and deployment

- Working baseline: protected `staging` branch at merge commit `61db86a` (PR #73) or later.
- Persistent staging uses the isolated Supabase staging branch and the `Common Time Staging` Stripe sandbox. Vercel Preview variables for branch `staging` point to those systems; Production variables remain Production-only.
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

## Immediate next test: automatic invoice webhook settlement

Do not redo card setup or the first $2.00 charge. The next human action is one new exact approved statement in staging, using synthetic data and Stripe test mode only.

1. Prepare a different billing month for the same synthetic family. Add a small explained test adjustment if the month has no billable lesson.
2. Lock the statement, send/open its payer approval path, and approve the exact amount.
3. Confirm the owner UI reads `Approved — ready to collect`, then hold the charge control exactly once.
4. Refresh/reopen the family page. The expected result is an automatic transition from `Payment submitted — awaiting confirmation` to a faint `Paid` card through the signed PaymentIntent webhook. No manual database reconciliation is allowed for this acceptance run.
5. Verify the durable provider event is `processed`, the attempt is `succeeded`, the period is `paid`, and the Stripe PaymentIntent/Charge are test-mode objects on the connected school account with the exact amount and metadata.
6. Record the deployment commit, local attempt/period IDs, non-secret Stripe event/intent/charge IDs, timestamps, and outcome in the payment audit log.
7. Only after this passes, select the next saved-card failure row: a decline test, authentication-required test, duplicate/concurrent submission test, or unknown-outcome recovery. Do not treat those rows as already tested.

### New October staging fixture

- On 2026-10-12, two synthetic one-time lessons were created through `create_single_lesson` for the sole staging family account (`TestStudent1Last family`, referred to in conversation as `TestFamily`).
- Both use `Staging Checkout Test – 30 min`, primary test teacher `JONATHAN ME`, and `TestPlaceA`: October 19 and October 26, 2026 at 10:00–10:30 AM America/Chicago.
- Lesson IDs are `894cab5c-973a-46fa-acf9-a820af61c07b` and `9f77d3a4-cedc-41d0-bb83-35abf29cc840`. Each has a $1.00 immutable price snapshot and October billing service date.
- Do not create these lessons again. The owner’s next action is to use them to prepare the new October statement, then continue the approval/automatic-webhook acceptance sequence above.

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
