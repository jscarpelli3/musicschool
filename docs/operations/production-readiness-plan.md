# Production Readiness Plan

This is the execution plan from supervised beta through a limited production pilot. A green application build is necessary, but it is not authorization to enable live charges or import real customer data.

## Operating rules

- Keep authorization at every server action, route handler, RPC, and row-level policy. `proxy.ts` is defense in depth, not the authorization boundary.
- Send the browser only fields it renders. Never pass full database rows, provider payloads, password hashes, internal notes, secrets, or unrelated tenant identifiers to a client component.
- Treat Stripe, Supabase, Resend, and Twilio callbacks as untrusted input until signatures, mode, account ownership, local object bindings, amounts, currency, and state transitions are verified server-side.
- Preserve append-only financial and audit evidence. Correct mistakes with explicit compensating records, not destructive edits.
- Fail closed on ambiguous provider outcomes. Reconcile before retrying.
- Never deploy migrations or charge execution merely because code review and CI pass. Environment-specific rehearsals are separate gates.

## Gate 0 — Preserve a safe beta lane

**Allowed:** one supervised invitation-only run with synthetic/test data, Stripe test mode, and no automatic collection.

**Before the run**

- [ ] Confirm Resend open and click tracking are disabled.
- [ ] Confirm the deployed commit and database migration level match the recorded beta checkpoint.
- [ ] Cold-test owner invitation and onboarding.
- [ ] Accept one teacher invitation and verify assignment-scoped access.
- [ ] Sign into the payer portal by OTP.
- [ ] Rehearse statement delivery, payer rejection, corrected replacement, and approval.
- [ ] Confirm approval creates no charge.

**Exit evidence:** dated run notes, identities/fixtures used, expected and actual results, provider delivery IDs, database audit records, and every defect filed with severity.

## Gate 1 — Accept one-time lesson payments in an isolated test environment

The one-time Checkout feature remains undeployed until this gate passes.

### Environment and migration

- [ ] Use a non-production Supabase project and Stripe test-mode connected account.
- [ ] Apply `20260916100000_lesson_quick_pay.sql` and `20260916101000_verify_lesson_quick_pay.sql` there.
- [ ] Replay all migrations from an empty database and run database lint.
- [x] Prove anonymous users cannot read or mutate payment requests.
- [x] Prove authenticated users without `school.billing.manage` cannot read requests.
- [x] Prove authenticated users cannot insert, update, delete, or directly complete requests.
- [x] Prove cross-school IDs and connected accounts are rejected. Checkout completion and expiration validate request, school, and lesson metadata against local immutable facts; both reject any Stripe account other than the request's stored school connection.

### Checkout and webhook matrix

- [ ] Successful card payment produces one succeeded request and one audit record.
- [ ] Cancel leaves financial truth unpaid and permits a safe retry.
- [ ] Expiration clears the stored Checkout URL and permits a new request.
- [ ] Concurrent clicks converge on one open request and one Stripe idempotency key.
- [x] Duplicate and out-of-order webhooks are idempotent. The database claim lease now has deterministic CI coverage for duplicate refusal, terminal replay, failed retry, and abandoned-worker recovery; paid-after-expired ordering and duplicate financial completion are also covered.
- [x] Provider acceptance followed by a failed local session-ID write is recoverable with the stable request idempotency key and signed metadata.
- [x] Wrong account, request ID, amount, currency, session mode, payment status, PaymentIntent status, and Charge state are rejected. Deterministic tests exercise every mismatch against the same validators and account guard used by webhook reconciliation.
- [ ] An already-paid lesson cannot be collected again.
- [ ] A separately paid lesson appears on a later statement at zero newly due, with durable allocation metadata.
- [ ] Logs and responses expose no raw provider payloads, signatures, secrets, stack traces, or unnecessary customer/payment data.

**Exit evidence:** CI results, migration replay output, Stripe event/session/intent/charge IDs, local request/audit IDs, reconciliation notes, and a signed gate decision in the payment audit log.

## Gate 2 — Automate the financial safety net

- [ ] Unit-test all pure payment eligibility and provider-binding rules.
- [ ] Add database tests for constraints, grants, RLS, service-role-only completion, idempotency, concurrency, and statement allocation.
- [x] Add mocked Stripe integration tests for creation, ambiguous failure, recovery, replay, and order changes. Production-used workflow tests cover creation, ambiguous provider response, local-write recovery, and duplicate completion; database tests cover paid-after-expired ordering and the actual webhook claim lease.
- [ ] Run the empty-database migration replay and verification migrations in CI.
- [ ] Make every test deterministic and tenant-aware; include at least two schools and cross-tenant denial cases.
- [ ] Block merges when tests, typecheck, lint, build, migration replay, database lint, dependency audit, or secret scanning fail.

## Gate 3 — Browser acceptance suite

- [x] Establish Playwright in CI with desktop/mobile Chromium smoke coverage, failure traces, screenshots, and video.
- [ ] Add Playwright journeys for owner onboarding, teacher invitation, payer OTP, scheduling, statement rejection/replacement/approval, and one-time test payment.
- [ ] Cover refresh, back navigation, stale tabs, double submission, expired links, and narrow/mobile layouts.
- [ ] Include keyboard-only checks and a focused automated accessibility scan.
- [ ] Run smoke journeys against preview deployments and the full suite against the isolated test environment.

## Gate 4 — Financial operations and recovery

- [ ] Add a reversible, school-level “Use Common Time without integrated payments” choice. It must suppress setup prompts without deleting provider evidence, and owners must be able to reconnect later.
- [ ] Treat provider review, remediable requirements, rejection, and voluntary opt-out as separate durable states. A rejected or long-running review must never block scheduling, attendance, family records, or manual billing workflows.
- [ ] Define a provider-neutral connection boundary before adding another processor. Square or an existing external Stripe workflow may be evaluated later, but the UI must not imply those integrations exist today.
- [ ] Implement authorized, lazy retrieval of Stripe-hosted receipts; do not persist expiring receipt URLs.
- [ ] Design and test full and partial refunds, disputes, failed payments, manual settlement, write-offs, reversals, and allocation history.
- [ ] Rehearse Stripe downtime, timeout after provider acceptance, webhook backlog, replay, and reconciliation.
- [ ] Ensure every operator action is capability-gated, rate-limited where appropriate, tenant-bound, and audited.
- [ ] Keep automatic collection disabled until its own notice, mandate, cap, failure, revocation, and recovery matrix passes.

## Gate 5 — Security and operations

- [ ] Replace the Stripe platform's personal fallback branding with Common Time name, icon, logo, and brand color before beta invitations or live onboarding.
- [ ] Complete the role-by-resource matrix for owner, admin, teacher, payer, guardian, student, anonymous, service role, and platform admin across at least two schools.
- [ ] Record and test hosted Auth session, refresh-token reuse, CAPTCHA, and rate-limit settings.
- [ ] Validate production host/origin/security headers and webhook size/signature defenses at the edge.
- [ ] Add error monitoring, actionable alerts, reconciliation queues, dashboards, and runbooks.
- [ ] Upgrade production infrastructure to supported commercial/backup plans.
- [ ] Restore a database and private Storage export into an isolated project and reconcile sampled provider records.
- [ ] Document incident response, access review, key rotation, rollback, and kill-switch procedures.
- [ ] Complete an independent security architecture review or penetration test and close all launch-blocking findings.

## Gate 6 — Limited production pilot

- [ ] Obtain an explicit go/no-go decision supported by Gates 0–5 evidence.
- [ ] Start with one school, card-only payer-present collection, documented support ownership, and a tested kill switch.
- [ ] Keep automatic charging and SMS disabled unless their independent gates pass.
- [ ] Reconcile Stripe and local financial records daily during the pilot.
- [ ] Review errors, support contacts, delivery failures, payment exceptions, and security events daily.
- [ ] Define pilot stop conditions before launch and stop immediately on unreconciled money, tenant leakage, authorization bypass, or lost audit evidence.

## Current position — 2026-09-18

- Gate 0 is conditionally ready for a supervised synthetic-data beta run; the operational checklist is not yet fully evidenced.
- Gate 1 code is committed in `a3213a4`, but its migrations and UI are not deployed and the live Stripe test matrix has not run.
- Gate 2 has begun: CI runs unit/invariant tests, payment provider-binding tests, a production dependency audit, typecheck, lint, a production build, a clean local Supabase migration replay with database lint, and two-school payment-request authorization tests. Deeper role/resource coverage and secret scanning are still incomplete.
- Gates 3–6 remain open. Therefore the product is suitable for controlled beta testing, not production handling of real families or live money.

### Updated beta checkpoint — 2026-09-23

- Persistent staging now has isolated Supabase and Stripe test-mode configuration, protected Git branches, working OAuth/onboarding, and verified signed Stripe webhook intake.
- The owner onboarding path has been exercised through school creation, first family, instruments, owner-as-teacher linking, and completion. A complete teacher-acceptance, payer-OTP, statement rejection/replacement/approval rehearsal remains open.
- CI runs dependency audit, invariant tests, typecheck, lint, production build, migration replay/database lint when migrations change, and required desktop/mobile browser smoke coverage. Secret scanning, monitoring, backup/restore rehearsal, authenticated browser journeys, and the full cross-tenant matrix remain open.
- Staging transactional email must use the code-enforced recipient allowlist documented in `staging-environment.md`; production email credentials remain Production-only.
- The decision remains: supervised beta with synthetic/test data after the complete multi-role rehearsal, not unattended production use, real family imports, live charges, or production SMS.

## Immediate execution order

1. Finish the cross-school and connected-account rejection matrix.
2. Replay/apply the migrations in the isolated payment test environment.
3. Run the remaining live Stripe Checkout/webhook matrix and record evidence.
4. Add the first authenticated Playwright beta journey, then expand it from defects found during the supervised run.
5. Add secret scanning and operational alerting before any live-money decision.
