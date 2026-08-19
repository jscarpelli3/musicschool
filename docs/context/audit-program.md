# Common Time audit program

This program defines repeatable audits for the build and eventual production service. An audit is evidence gathering, not a confidence statement. Every run records date, environment, commit/deployment, scope, checks performed, findings, severity, owner, remediation, retest evidence, and unresolved risk.

The append-only master record for security process changes, scans, findings, remediation, retests, and open security work is `docs/audits/security-audit-log.md`. Every security-focused audit or scan must be recorded there; feature-specific logs may link to it rather than duplicate evidence.

## Operating rules

- Never mark an audit passed because code compiles or a provider returned `200`. Verify the resulting application and database state.
- Run destructive and provider-money rehearsals only in isolated test data/test mode unless a production action is explicitly authorized.
- Use immutable or append-only evidence for billing, consent, provider events, refunds, credits, and security-sensitive changes.
- A failed audit creates a tracked finding. Fixes require a focused retest plus the relevant regression audit.
- Keep secrets, raw payment credentials, approval bearer tokens, and unnecessary personal data out of audit output.
- Record assumptions and checks that could not be completed. `Not tested` is never equivalent to `passed`.
- Distinguish implemented locally, deployed, and live-tested evidence. Record security audit process changes in the master security log.

## Audit suites

### 1. Security, identity, and tenant isolation

- Authentication returns, session handling, logout, magic-link/OTP expiration, and open-redirect resistance.
- Role authorization for owner, admin, teacher, staff, payer, student, anonymous user, and platform operations.
- Cross-school and cross-family read/write denial at UI, Server Action/API, RPC, RLS, Storage, and provider-object layers.
- Bearer-token hashing, single-purpose scope, expiration, supersession, replay resistance, and post-decision invalidation.
- Secret placement, least-privilege provider keys, signature verification, dependency advisories, security headers, CSP, rate limits, and abuse controls.
- PII exposure in logs, URLs, email/SMS previews, analytics, errors, exports, and backups.

### 2. Financial integrity and ledger reconciliation

- Statement calculation for before-service and after-service billing, three/four/five-lesson months, fixed tuition, per-session charges, policies, substitutions, reschedules, cancellations, and no-shows.
- Immutability across draft, review, locked, approval-pending, approved, collection, paid, failed, refunded, disputed, voided, and written-off states.
- One-off charges, statement adjustments, persistent account credits, reservation/application/release, reversals, refunds, partial refunds, and prevention of double application.
- Approval or active mandate required before every charge; cap, notice window, revocation, idempotency, retry, and duplicate-charge protection.
- Decline/failure classification, owner-alert deduplication, retry eligibility, new-method recovery, manual settlement, credit application, write-off, and eventual provider reconciliation.
- Bulk month preparation with partial family blockers, idempotent reruns, review-queue totals, eligible-only bulk locking, and proof that neither preparation nor locking sends or charges.
- Local totals reconciled to Stripe PaymentIntents, Charges, Refunds, fees where relevant, and webhook state. Provider acceptance is not settlement.
- Cash/manual payments remain explicit, attributable, auditable, and never masquerade as Stripe settlement.

### 3. Workflow and state-machine audit

- Exercise every allowed state transition and verify every forbidden transition fails without partial mutation.
- Confirm exact next actions, state-exclusive controls, disabled-action explanations, stale-message clearing, and back/refresh/retry behavior.
- Test happy paths, payer rejection, owner revision, expired/superseded links, abandoned setup, late provider events, concurrent tabs, and double submission.
- Verify notification, statement, consent, collection, receipt, correction, credit, and refund workflows remain separate where their legal or financial meaning differs.

### 4. External API and webhook audit

- Run the mandatory provider-specific Stripe and Resend regression suites maintained in `docs/audits/security-audit-log.md`; record every run and finding there.
- Stripe, Resend, Twilio, Supabase, Google OAuth, and Vercel configuration inventory by environment and tenant scope.
- Request validation, timeouts, retry/backoff, idempotency keys, pagination, API-version pinning, rate-limit behavior, and safe error translation.
- Signature validation against the raw request, replay detection, out-of-order and duplicate delivery, unknown-event handling, endpoint mode/account matching, and durable intake before processing.
- Reconciliation jobs recover events missed during downtime. Provider dashboards and APIs agree with local event and delivery history.
- Receipt links are retrieved lazily from Stripe using durable object IDs and the correct connected-account context; hosted URLs are not persisted as permanent records.

### 5. Error handling and recovery audit

- Network failure before request, after provider acceptance, during local finalization, and during browser navigation.
- Clear user-facing error, unchanged or recoverable local state, safe retry, and no duplicate external side effect.
- Dead-letter/manual-review path for unreconciled events and provider objects.
- Database backup/restore, migration rollback strategy, data export, deleted-user/school retention behavior, and recovery-point evidence.
- Domain, environment-variable, webhook-secret, OAuth-return, and provider-callback cutover rehearsal using the maintained cutover inventory.

### 6. Data model and database audit

- Constraints, foreign keys, uniqueness, tenant-composite keys, RLS coverage, grants, SECURITY DEFINER search paths, RPC authorization, and migration drift.
- Historical snapshots remain immutable when products, policies, teachers, places, payer details, or school defaults change.
- Required relationships are neither ambiguous nor orphaned; background reconciliation and cleanup never silently discard business records.
- Database lint, generated types, deterministic migration application, rollback-only invariant rehearsals, and seeded edge cases.

### 7. Product, UI, accessibility, and responsive audit

- Every visible action maps to durable server/database behavior; no UI-only business truth.
- Phone, touch-only tablet, keyboard, desktop, reduced motion, large text, focus order, semantic labels, and contrast.
- No required hover, hidden overflow, unreachable dialog action, or destructive action without appropriate confirmation.
- Billing and scheduling language communicates the current object, state, consequence, and exact next action without exposing provider jargon.
- Empty, loading, failure, stale, partial, and populated states use real data and remain navigable.

### 8. Performance and dependency audit

- Route/server timing, database query count and indexes, payload size, client JavaScript, images, caching correctness, and provider-call latency.
- Package inventory remains lean; each runtime dependency has a current use, acceptable maintenance/security posture, and no lighter existing solution.
- Production build, typecheck, lint, dead-code scan, bundle review, and realistic mobile-network smoke test.

### 9. Privacy, consent, and communications audit

- Email/SMS consent source, disclosure version/hash, recipient identity, opt-out/revocation, suppression, and school-specific sending identity.
- Payment-method and auto-charge consent remain distinct; approval language matches the exact amount/scope.
- Data minimization, retention/deletion, guardian/minor access boundaries, policy/document versioning, and support access are documented and enforced.
- Templates contain required identity/help/opt-out language and never leak another family or school's data.

### 10. Operational readiness audit

- Environment inventory, ownership, alerts, provider health, webhook backlog, reconciliation failures, payment failures, bounce/complaint rates, and expiring credentials.
- Support procedures for incorrect statement, rejected approval, duplicate charge, lost access, refund, credit, dispute, and provider outage.
- Production access is least privilege and auditable. Platform support impersonation or elevated access, if later added, requires explicit reason and evidence.

## Cadence and gates

### Every material feature or migration

- Focused security/tenancy check.
- State transition and error-path test.
- Data persistence/audit evidence check.
- Typecheck, lint, and relevant database lint/invariant rehearsal.
- Phone, touch-tablet, keyboard, and desktop check when UI changes.

### Before each production deployment

- Diff-scoped release audit covering authorization, migrations, secrets/config, provider side effects, rollback/recovery, and smoke tests.
- Confirm no unresolved critical/high finding and explicitly accept or defer lower risks.

### At each roadmap milestone

- Full financial, workflow, API/webhook, error/recovery, responsive/accessibility, and documentation audit for that milestone.
- Rehearse the complete user flow with real provider test events, not only mocks.

### Monthly in production

- Dependency/security advisory review, RLS/grant drift, webhook/reconciliation backlog, failed payments/refunds, delivery suppressions, privileged access, backup evidence, and provider configuration drift.

### Quarterly in production

- Full cross-tenant authorization matrix, restore rehearsal, key/secret inventory and rotation review, privacy/retention review, financial reconciliation sample, accessibility regression pass, and incident-response tabletop.

### Before a real-domain, provider-mode, or major policy cutover

- Run the domain/environment cutover checklist, OAuth and webhook signature tests, test/live object-separation checks, receipt retrieval, communications identity/consent review, rollback plan, and post-cutover reconciliation.

## Finding severity

- **Critical:** credible unauthorized access, secret exposure, incorrect/duplicate money movement, irrecoverable data loss, or cross-tenant disclosure. Block deployment and disable the affected path if live.
- **High:** authorization/state-integrity weakness or provider reconciliation failure with material customer impact. Block the affected release.
- **Medium:** recoverable functional, accessibility, or operational failure with a workaround. Track owner and deadline.
- **Low:** clarity, maintainability, or minor edge-case issue without immediate integrity impact. Batch deliberately; do not silently forget it.

## Minimum audit record

Each audit entry must include:

- Audit suite and objective
- Date/time, auditor, environment, commit, and deployment ID
- Fixtures/accounts/providers used
- Checks and expected results
- Actual application, database, and provider evidence
- Findings with severity and affected scope
- Changes made, or explicit deferral and rationale
- Retest result and remaining risk
