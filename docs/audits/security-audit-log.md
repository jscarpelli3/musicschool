# Common Time master security audit log

This is the living, append-only security due-diligence record for Common Time. It documents what was examined, how it was examined, the evidence obtained, findings, remediation, retesting, deferred risk, and changes to the audit process itself. It complements the broader program in `docs/context/audit-program.md`.

This record is evidence of a repeatable security practice; it is not a claim that the application is invulnerable, legally compliant, or free of undiscovered defects. A check that was not performed is recorded as **not tested**, never inferred as passed.

## Recordkeeping rules

- Append a dated entry for every security scan, focused security review, incident-driven review, release security gate, and periodic audit.
- Give each run and finding a stable identifier. Do not silently delete or rewrite prior findings; add a correction or status update.
- Record UTC time, auditor, environment, commit, deployment, scope, tools/checks, evidence, findings, remediation, retest, and remaining risk.
- Separate **implemented locally**, **deployed**, and **live-tested**. None implies either of the others.
- Keep credentials, raw bearer tokens, full provider payloads, unnecessary personal data, and exploitable production details out of this document.
- Preserve supporting evidence in an access-controlled system when it cannot safely live in Git. Record a non-secret evidence reference here.
- Every Critical or High finding blocks the affected deployment until remediated, disabled, or explicitly accepted by the accountable owner with rationale and expiration.
- Every remediation receives a focused retest and the relevant regression suite. Closing a ticket without retest does not close the finding.

## Security audit scope

Each full audit evaluates, where applicable:

1. Identity lifecycle: provisioning, verification, login, OTP/OAuth callbacks, session refresh, logout, revocation, recovery, deactivation, and orphan cleanup.
2. Authorization and tenancy: anonymous, payer, teacher, staff, admin, owner, and platform boundaries across UI, Server Actions, route handlers, RPCs, RLS, Storage, background work, and provider objects.
3. Data protection: secrets, PII, minors/guardians, logs, URLs, exports, analytics, backups, retention, deletion, and support access.
4. Database security: constraints, tenant-composite foreign keys, RLS, grants, `SECURITY DEFINER` ownership/search paths, migration drift, concurrency, and direct-table denial.
5. Application and API security: validation, injection, CSRF, XSS, SSRF, open redirects, unsafe deserialization, file handling, headers, CSP, caching, and error disclosure.
6. Abuse resistance: rate limits, enumeration, credential/OTP abuse, replay, duplicate submission, idempotency, automation, notification spam, and denial-of-service controls.
7. Provider boundaries: Supabase, Stripe, Resend, Twilio, Google, Vercel, DNS, webhook signatures, account/mode scope, API versions, retries, and secret rotation.
8. Dependency and supply chain: inventory, lockfiles, advisories, abandoned packages, build scripts, CI permissions, provenance, and deployment dependencies.
9. Operational security: privileged access, audit logs, alerts, incident response, backup/restore, recovery, configuration drift, domain cutover, and responsible disclosure.
10. Business-integrity security: payment authorization, immutable evidence, state transitions, cancellation/rescheduling rights, notification separation, and prevention of unauthorized financial side effects.

## Repeatable audit procedure

### Preparation

- Identify the environment, commit/deployment, data classification, affected tenants, trust boundaries, provider mode, and prior open findings.
- Define safe fixtures. Use synthetic data and provider test modes unless a production check is explicitly authorized.
- Review the diff and update the threat model: assets, actors, entry points, privileges, external systems, misuse cases, and failure modes.

### Automated and structural checks

- Typecheck, lint, production build, dependency/advisory review, secret scan, static security scan, and dead-code/config review.
- Database lint, migration replay, RLS/grant inventory, `SECURITY DEFINER` review, constraint/index review, and generated-type drift.
- Route and Server Action inventory with authentication, authorization, validation, rate-limit, and side-effect classification.
- Header/CSP/cookie/TLS configuration review and provider webhook/configuration comparison.

### Adversarial manual checks

- Execute the role-by-resource authorization matrix, including cross-school and cross-family identifiers.
- Exercise stale sessions, changed identities, inactive records, replay, concurrency, duplicate data, guessed identifiers, malformed input, expired links, and provider failures.
- Verify denial at the authoritative server/database boundary, not merely hidden UI controls.
- Inspect resulting database, provider, notification, and audit state for partial mutation or leaked information.

### Exit and evidence

- Classify findings using the severity rules in `docs/context/audit-program.md`.
- Record exact remediation status and unresolved risk. Assign an owner and target/trigger for every open finding.
- Run focused retests plus regression checks. Record actual evidence and distinguish local, deployed, and live results.
- Update this process when a review exposes a missing class of check.

## Stripe API security regression suite

Run this suite for every material Stripe integration change, before switching provider mode or webhook destinations, and during the recurring full audit. Inventory every current Stripe call and webhook event before starting; future payment/refund/dispute endpoints inherit this gate automatically.

### Configuration and trust boundaries

- Confirm test/live mode, API-version pinning, platform versus connected-account context, webhook destinations, active/retiring signing secrets, return URLs, and least-privilege secret placement in every environment.
- Prove that school, billing account, customer, setup session, payment method, PaymentIntent, Charge, Refund, and connected-account identifiers are resolved server-side and checked against durable tenant bindings. Never trust browser metadata or a provider object ID alone as authorization.
- Verify production responses and logs do not expose Stripe secrets, signatures, raw payment details, internal stack traces, or unnecessary webhook payload data.

### Outbound Stripe calls

- Test anonymous, teacher, unrelated-school member, stale-session, and guessed-ID denial for account onboarding, account synchronization, customer creation, card setup, method revocation, and every future collection/refund action.
- Verify amount, currency, payer, school, connected account, customer, idempotency key, metadata, return path, and authorization source are calculated from authoritative state immediately before each side effect.
- Exercise timeout/failure before request, after provider acceptance, and during local finalization. Prove retries cannot create duplicate customers, sessions, methods, charges, refunds, or local records.
- Retrieve newly created or returned objects from Stripe in the expected connected-account context before accepting them locally. Reject wrong mode, account, customer, object type, status, currency, or amount.

### Stripe webhook intake and processing

- Test missing, malformed, forged, stale, and correctly signed requests against the raw body for every configured secret during rotation; cover both supported classic and v2 event formats.
- Test malformed JSON, oversized/unexpected payloads, unsupported event types, missing account/object IDs, wrong test/live mode, unknown connected accounts, and provider objects belonging to another school.
- Replay identical events sequentially and concurrently; deliver related events out of order; reclaim a deliberately failed and an expired-processing-lease event. Verify one durable intake record, one permitted business mutation, safe duplicate acknowledgement, and retained failure evidence.
- Confirm intake durability precedes business processing, provider `5xx` retries recover transient failures, unsupported events become explicitly ignored, and logs/errors contain safe identifiers only.
- Reconcile a sample of local provider events and resulting customer/method/payment state directly against Stripe. A webhook HTTP `200` alone never passes the audit.

### Stripe evidence required

- Record Stripe mode, account scope, endpoint/event inventory, API version, non-secret webhook destination/secret-rotation state, fixture IDs safe to retain, request/result matrix, local database evidence, provider-dashboard/API evidence, replay/concurrency results, failures, and cleanup.

## Resend API security regression suite

Run this suite for every material sending, template, retry, suppression, or webhook change; before sender-domain/webhook/key cutovers; and during the recurring full audit. Inventory every application message kind, outbox, sender identity, recipient resolver, retry path, and webhook event first.

### Configuration and outbound sending

- Confirm API-key placement and scope, verified domain, exact From addresses, webhook destination/signing secret, environment separation, provider tracking settings, and key-rotation procedure.
- Test anonymous, payer, teacher, unrelated-school member, stale-session, and guessed-ID denial for each send/retry/report action. Derive recipients and tenant context from authoritative server data, not submitted email addresses or record IDs alone.
- Verify subject, HTML, text, display name, and recipient fields resist header/HTML injection; templates escape user/school content; messages contain no bearer token except the deliberately scoped destination required by that workflow.
- Require a durable outbox/attempt before the provider call, stable idempotency where supported, bounded retry/cooldown, and explicit separation between business truth and delivery truth.
- Exercise invalid key, timeout before acceptance, ambiguous timeout after possible acceptance, provider `4xx`, provider `5xx`, rate limit, invalid/suppressed recipient, bounce, complaint, and recovery. Prove retries cannot duplicate business actions or silently bypass suppression.

### Resend/Svix webhook intake and reconciliation

- Test missing, malformed, forged, stale, and valid `svix-id`, `svix-timestamp`, and `svix-signature` headers against the untouched raw body.
- Test malformed/unsupported payloads, unknown event types, missing provider email/event IDs, invalid timestamps, recipient mismatch, unknown provider email IDs, and webhook events arriving before local provider-ID finalization.
- Replay identical events sequentially and concurrently and deliver sent/delayed/delivered/failed/bounced/complained/suppressed events out of order. Verify deduplication and monotonic terminal-state handling so late events cannot resurrect a failed/suppressed message or downgrade delivery truth.
- Confirm permanent bounce/complaint suppression has the intended global-versus-school scope, cannot be bypassed by manual retry, and can be corrected only through an authenticated, audited support process.
- Reconcile local attempts/outboxes against Resend provider events for a sample of success, transient failure, permanent failure, retry, and complaint cases. Provider handoff alone never proves delivery.

### Resend evidence required

- Record sender domain/address, message-kind inventory, endpoint/event inventory, non-secret webhook configuration state, fixture delivery IDs safe to retain, authorization matrix, signature/replay/out-of-order results, outbox/database evidence, provider evidence, suppression/retry results, failures, and cleanup.

## Required audit entry template

```text
Audit ID:
Date/time (UTC):
Auditor:
Environment:
Commit/deployment:
Trigger and objective:
Scope and exclusions:
Fixtures/providers:
Checks performed:
Evidence/results:
Findings:
Changes made:
Retest:
Open risk and next action:
Decision: pass / conditional pass / fail / not completed
```

## Open security TODOs

- **SEC-TODO-001 — Initial comprehensive baseline audit:** Run the complete procedure across the current application before production customer data is introduced. Produce route/RPC/RLS/provider/secret/dependency inventories and a role-by-resource denial matrix.
- **SEC-TODO-002 — Automated audit pipeline:** Add CI secret scanning, dependency advisory checks, static analysis, migration replay, database lint, RLS/grant drift checks, and security-test reporting with retained build evidence.
- **SEC-TODO-003 — Portal abuse controls:** Assess and implement unobtrusive throttling for portal email-status checks and OTP requests. Test account enumeration, distributed attempts, resend cooldown, and provider rate-limit behavior. Avoid CAPTCHA until risk justifies its visible friction.
- **SEC-TODO-004 — Portal live boundary rehearsal:** After migration deployment, test unknown, unprovisioned, valid-empty, valid-populated, inactive, duplicate-within-school, same-email-across-schools, changed-email/stale-session, cross-family identifier, and concurrent-update cases.
- **SEC-TODO-005 — Auth lifecycle cleanup:** Define safe retention and cleanup for Auth identities no longer authorized by any payer account without disrupting staff identities or identities still used by another school.
- **SEC-TODO-006 — Periodic cadence ownership:** Assign accountable people and calendar reminders for pre-deploy, monthly, quarterly, cutover, and incident-driven audits.
- **SEC-TODO-007 — Independent review:** Before handling live payments and family data at scale, arrange a qualified independent penetration test/security architecture review and track every result here.
- **SEC-TODO-008 — Stripe API baseline and automation:** Run the dedicated Stripe suite against every current outbound operation and webhook event, close findings, then automate signature, replay, concurrency, wrong-account, wrong-mode, idempotency, and failure-recovery cases where practical.
- **SEC-TODO-009 — Resend API baseline and automation:** Run the dedicated Resend suite against every message kind and webhook event, close findings, then automate signature, replay, ordering, recipient mismatch, idempotency, suppression, retry-limit, and provider-failure cases where practical.

## Audit process change log

### SEC-PROCESS-2026-08-19-001 — Master security record established

- Created this append-only master record and linked it to the broader audit program.
- Added stable audit/finding/TODO identifiers, evidence requirements, explicit local/deployed/live distinctions, severity gates, retest requirements, and process-change logging.
- Added explicit identity lifecycle, tenant/family boundaries, abuse/enumeration, provider scope, dependency/supply-chain, operational, and business-integrity coverage.
- Added the rule that security process gaps discovered during an audit must update the procedure and be logged here.

### SEC-PROCESS-2026-08-19-002 — Stripe and Resend API suites added

- Expanded the general provider review into mandatory, repeatable Stripe and Resend regression suites.
- Added configuration, tenant/object ownership, outbound authorization, raw-body signature verification, replay, concurrency, ordering, idempotency, ambiguous failure, provider reconciliation, suppression, safe logging, and evidence requirements.
- Added explicit baseline-and-automation work as `SEC-TODO-008` and `SEC-TODO-009`. Future Stripe payment/refund/dispute APIs and Resend message kinds enter these suites automatically when introduced.

## Audit run log

### SEC-AUDIT-2026-08-19-001 — Family portal identity and tenant-boundary review

- **Date/time:** 2026-08-19 17:28:54 UTC.
- **Auditor:** Codex working with the product owner.
- **Environment:** Local application and migration workspace; hosted Supabase deployment pending.
- **Commit/deployment:** Changes are uncommitted and undeployed at this checkpoint. The earlier read-only portal foundation is commit `1e12d58` with migration `20260819100000` deployed.
- **Trigger/objective:** First live OTP attempt exposed signup-template behavior, persistent-session confusion, unknown-account handling, and duplicate test emails. Review and harden payer identity, cross-family, and cross-school boundaries without adding normal-flow UI friction.
- **Scope:** `/portal` request/verification/session UI; portal RPC authorization; payer email edits; silent Supabase Auth provisioning; active billing-account/student relationships; duplicate email handling; logout scope; database grants and regression assertions.
- **Excluded/not tested:** Deployed migration behavior, live cross-tenant attempts, provider rate limits, distributed enumeration, Auth cleanup, payer creation UI (not yet implemented), cancellation/rescheduling mutations, and independent penetration testing.

#### Findings and disposition

- **SEC-FIND-2026-08-19-001 — High — Portal authorization followed general contacts.** The deployed foundation derives students through `student_contacts`, which is broader than the agreed payer-account boundary. Remediation implemented locally: lesson access now requires a private active payer authorization, its exact active billing account, and `billing_account_students`. Direct family access to underlying tables remains denied. **Status: remediated locally; deployment and live retest pending.**
- **SEC-FIND-2026-08-19-002 — High — Unknown emails could create Auth users.** `signInWithOtp` used `shouldCreateUser: true`, causing first access to use the signup template and allowing unprovisioned identities to be created. Remediation implemented locally: only an authenticated school owner/admin may silently provision an identity while maintaining a payer email; `/portal` uses `shouldCreateUser: false`. **Status: remediated locally; deployment and live retest pending.**
- **SEC-FIND-2026-08-19-003 — High — Duplicate payer emails could aggregate families.** Matching by email could combine students attached to separate payer records. Remediation implemented locally: private `payer_portal_authorizations` enforce uniqueness on `(school_id, normalized_email)`, preserve legitimate reuse across schools, and deny ambiguous legacy data. Database synchronization is transactional and normal UI remains unchanged. **Status: remediated locally; deployment, concurrency test, and live retest pending.**
- **SEC-FIND-2026-08-19-004 — Medium — Unknown and valid-empty states were conflated.** An authenticated but unauthorized email saw “No upcoming lessons,” obscuring the authorization failure. Dedicated `not_setup`, `ambiguous`, and `ready` server-derived states are implemented locally; only `ready` may query lessons. **Status: remediated locally; deployment and live retest pending.**
- **SEC-FIND-2026-08-19-005 — Low — Existing session identity was not visible.** A retained session skipped email entry without clearly identifying the active address. The portal now displays the signed-in email and offers “Use a different email.” **Status: remediated locally; UI retest pending.**
- **SEC-FIND-2026-08-19-006 — Medium — Portal sign-out used broad default scope.** The family sign-out could revoke more sessions than intended. It now uses local-session scope. **Status: remediated locally; multi-session retest pending.**
- **SEC-FIND-2026-08-19-007 — Medium — Public access-state probing needs abuse review.** The agreed not-setup/duplicate responses can reveal limited payer-account state and the preflight endpoint may be automated even though it returns no family data and OTP delivery remains provider-limited. **Status: open; tracked by SEC-TODO-003.**

#### Implemented controls and evidence

- Added a private payer-portal authorization table with one authorization per billing account and uniqueness within a school, while allowing the same normalized email at different schools.
- Added transactional synchronization for payer email, status, and billing-contact changes; duplicate writes fail at the database boundary.
- Added service-role-only Auth identity lookup and owner/admin-gated silent identity provisioning. Provisioning failure prevents the payer email change; an orphan identity cannot authorize data by itself.
- Changed portal OTP requests to prohibit Auth self-creation.
- Replaced general-contact lesson access with payer-account/student assignment access and deny-by-default access-state checks.
- Added a verification migration asserting private-table denial, unique school/email authorization, service-role-only identity lookup, authenticated-only lesson RPC execution, and absence of `student_contacts` from the portal lesson function.
- TypeScript passed, focused ESLint passed, and the Next.js 16.3 production webpack build passed. The first sandboxed build failed only because Google Fonts required network access; the authorized network build completed successfully.

#### Exit decision

- **Decision: not completed / deployment blocked for this feature.** The local remediation is ready for database validation, but Supabase CLI authentication is unavailable in the working shell. Do not publish the application changes before migrations `20260819113000` and `20260819114000` deploy and pass linked lint/verification.
- **Next action:** authenticate Supabase CLI, dry-run/review and apply migrations, run linked database lint, regenerate types if needed, deploy the application, execute SEC-TODO-004, append evidence here, then change each finding only through a dated status update.
