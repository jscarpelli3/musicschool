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

Status: In progress  
Activated: 2026-08-05

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

### Current decision

Proceed with provider-aware but locally enforceable payment-ledger schema design. Do not add live Stripe controls or secrets during this step.
