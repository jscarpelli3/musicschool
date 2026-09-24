# Active Session Handoff

Updated 2026-09-24 after staging Stripe Connect onboarding reached the ready state. This file is the quickest restart point after a lost conversation; the authoritative launch gates remain in [`../operations/production-readiness-plan.md`](../operations/production-readiness-plan.md).

## Current branch and deployment

- Working baseline: protected `staging` branch at merge commit `360dbc2` (PR #44) or later.
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

## Immediate next test: first hosted lesson payment

The next human action is an end-to-end successful Stripe Checkout transaction in staging. Do not switch to live mode and do not use a real card.

1. Confirm the staging Payments page still reports payments and payouts enabled.
2. Confirm a positive, per-session school offering is synchronized to the same connected Stripe account.
3. Confirm a scheduled or completed lesson uses that offering and its student belongs to exactly one active billing account.
4. Open the lesson and choose `Collect payment now`, then `Create payment QR code`.
5. Open Stripe Checkout separately (an incognito window or payer phone is appropriate) and use Stripe's successful test card `4242 4242 4242 4242`, any future expiry, any three-digit CVC, and any valid postal code.
6. Keep the Common Time payment page open. Its 2.5-second refresh should change `Waiting for Stripe confirmation…` to `Payment confirmed` after the signed connected-account webhook is reconciled.
7. Verify in Common Time that the lesson is paid separately and cannot be collected again.
8. Verify in the Stripe sandbox that the Checkout Session, PaymentIntent, and Charge belong to the connected school account—not merely the platform account.
9. Record non-secret provider IDs, the local payment-request/audit IDs, timestamps, deployment commit, and actual results as Gate 1 evidence.
10. Next run cancellation/no-charge, expiration/retry, duplicate/concurrent click, already-paid, and later-statement-zero-due cases from the matrix in the readiness plan.

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
