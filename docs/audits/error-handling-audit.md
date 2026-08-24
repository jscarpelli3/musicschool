# Common Time error-handling audit and plan

This is the living source of truth for how Common Time detects, classifies, communicates, records, retries, and tests failures. It covers expected application errors, unexpected exceptions, database failures, authentication and authorization, external providers, webhooks, background/durable delivery, and recovery UX.

This document is an engineering audit, not proof that every path has been live-tested. Each audit run must distinguish source inspection, automated test evidence, provider test evidence, and live UI evidence.

## Audit record

| Run | Date | Environment / commit | Evidence | Result |
| --- | --- | --- | --- | --- |
| EH-001 | 2026-08-24 | Local working tree; commit not recorded | Full source scan of `src/app`, `src/components`, `src/lib`, current Supabase migrations, Next.js 16.3 error-handling guidance, package scripts, and existing audit program | Baseline established; implementation and runtime test work remains open |

### EH-001 scope and limitations

- Read-only runtime audit. No production behavior, database schema, or provider configuration was changed.
- No browser, network-failure, provider, webhook replay, or database-fault injection was performed.
- No automated error-path test suite is currently visible in the repository.
- The audit includes Supabase/Auth, Stripe, Resend, Twilio, calendar token routes, Server Actions, client-side mutations, Server Components, and route handlers.
- Secret values and customer data were not inspected or recorded.

## Executive assessment

Common Time already has several good domain-specific recovery patterns: billing email and SMS attempts are represented durably, retries are bounded, provider event intake is idempotent, Stripe webhook processing records failure state, and many consequential actions return plain-language results without exposing provider details.

The main weakness is inconsistency. Expected failures currently use at least four incompatible channels: typed `{ ok, message }` returns, `{ error }` returns, redirects with ad hoc query-string flags, and thrown exceptions. There are no route-level `error.tsx`, `global-error.tsx`, `not-found.tsx`, or `loading.tsx` files. Unexpected failures therefore lack a designed recovery screen, a stable incident reference, and a consistent reporting path. Logging is sparse and unstructured, accepted-provider/local-finalization gaps are not handled uniformly, and client network exceptions sometimes collapse into feature-specific copy that is factually wrong.

The target is not to show users more technical detail. It is to make every failure produce three separate outputs:

1. A safe, specific next step for the user.
2. Durable state sufficient to recover or reconcile the operation.
3. Structured diagnostic evidence with a correlation ID for operators.

## Current pattern inventory

### Expected Server Action errors

The strongest current pattern returns a small discriminated result such as `{ ok: false, message }` and lets a client component render it through `useActionState` or `HoldToConfirm`. Examples include teacher lesson outcomes, teacher rescheduling, family billing mutations, payer approvals, SMS consent, calendar subscriptions, notification management, and lesson-change requests.

Strengths:

- Expected failures do not always become exceptions.
- Many messages describe whether state changed, such as “The lesson has not moved yet” or “No text was sent.”
- Known database domain codes are translated into user language in teacher and billing flows.
- Consequential interactions commonly prevent duplicate submission while pending.

Inconsistencies:

- Result shapes vary among `{ ok, message }`, `{ error }`, data-bearing success objects, and redirects.
- The result has no stable error code, field errors, retryability, correlation ID, or indication that an operation requires reconciliation.
- Database error recognition uses substring matching against `error.message`, which is brittle and couples UI behavior to PostgreSQL exception text.
- Authentication failure sometimes returns an inline result and sometimes redirects to login.
- Authorization failure sometimes redirects to the school dashboard, sometimes returns “not authorized,” and sometimes becomes a not-found result through RLS.
- Several actions discard the original diagnostic entirely after translating it.

### Redirect status messages

Profile, setup, appearance, products, places, lessons, payments, and staff flows use query flags such as `?status=error`, `?invite=delivery-failed`, or `?stripe=sync-error`.

Strengths:

- The pattern survives a redirect and page refresh.
- URLs contain coarse status keys rather than raw provider messages.

Weaknesses:

- Each route maintains its own untyped vocabulary and message mapping.
- Flags can be manually constructed and can remain visible on refresh or browser history.
- The pattern cannot carry field-level validation or a diagnostic reference.
- Pending feedback is absent unless the submitting form independently implements it; this is the immediate cause of the teacher-invite “nothing happened” experience.
- Redirecting away from an unauthorized action often fails to explain why the action was refused.

### Client-side calls and mutation feedback

Client Auth calls explicitly manage pending state and friendly messages. `HoldToConfirm` centralizes hold progress, submitting state, success/error status, an `aria-live` message, and optional refresh.

Strengths:

- Login and portal OTP flows disable controls while requests are pending.
- The shared hold control catches rejected promises and provides retry affordance.
- Portal request confirmation separates in-app receipt from downstream email delivery, avoiding unnecessary anxiety for the family.

Weaknesses:

- `HoldToConfirm` now accepts feature-specific fallback copy, but existing call sites have not yet been audited to ensure each supplies the most accurate recovery language.
- It assumes every action resolves to exactly `{ ok, message }` and has no error code or error-specific callback.
- A JavaScript/network exception is not distinguished from a server-declared rejection or an unknown-after-submit state.
- Google sign-in displays `authError.message` directly, unlike the OTP flows. Provider wording can be confusing and is not a stable public contract.
- There is no shared form field error treatment, summary focus behavior, offline detection, or standardized retry affordance.
- Success states sometimes refresh and sometimes remain local; stale state behavior is decided feature by feature.

### Server Component/render failures

Many data-loading pages throw new `Error` when Supabase queries fail. Some include the raw Supabase message in the thrown error; others use a generic sentence. Missing or inaccessible school and public approval records often use `notFound()`. Auth absence usually redirects to login.

Strengths:

- Missing bearer-token resources are intentionally indistinguishable from invalid ones.
- Authentication and route authorization are generally checked before protected content renders.
- Empty business data is usually rendered as a normal empty state rather than an error.

Weaknesses:

- No `error.tsx` or `global-error.tsx` exists, so users have no Common Time recovery UI for uncaught render failures.
- No custom `not-found.tsx` exists, so expired/missing routes do not share a product-specific safe next step.
- No `loading.tsx` exists; navigation and slow Supabase reads lack consistent route-level progress feedback.
- Raw database error messages are embedded in several thrown exceptions. Production Next.js normally hides server details from the browser, but this still creates uneven logging and possible disclosure in development or future instrumentation.
- Several layout queries ignore their `error` fields and treat query failure like “not found,” which can incorrectly present an outage or RLS regression as a missing school.
- There is no partial-data policy. Most multi-query pages either throw on the first error or silently ignore noncritical failures such as signed URL generation.

### Authentication and Supabase

Supabase browser and server clients are centralized, and the admin client is server-only with configuration checks. OTP flows use `shouldCreateUser: false`. Portal authorization is rechecked against current school data.

Gaps:

- Public environment variables use non-null assertions in browser/server client factories, so misconfiguration fails indirectly rather than with an actionable startup diagnostic.
- Auth callback failure collapses all exchange errors into `/login?error=auth`; no correlation or reason class is retained.
- Teacher membership activation after OTP ignores the RPC result before navigating.
- Portal access-state lookup treats a database/network failure as “portal not set up,” which is factually different and may send users to the school unnecessarily.
- Some auth identity provisioning catches all errors and redirects to `identity-error`, losing whether the failure was conflict, rate limit, configuration, or transient provider failure.
- RLS/authorization denials, missing records, and database outages are not mapped through a single translation layer.

### Database and RPC errors

The database carries substantial business invariants and many RPCs return domain status values or raise recognizable domain errors. Delivery/outbox tables preserve provider IDs, failure codes, messages, retry counts, cooldowns, and timestamps.

Strengths:

- Critical workflow decisions live in atomic RPCs rather than UI state.
- Billing and notification flows often state whether a failed provider call changed local state.
- Provider callbacks and approval actions have meaningful idempotency and uniqueness protections.

Gaps:

- There is no canonical registry of database domain error codes and their public/operator mappings.
- Substring parsing of PostgreSQL messages is used instead of a structured return/status convention.
- Supabase error codes, constraint names, RPC domain failures, network failures, and unexpected nulls are frequently collapsed into the same message.
- Some database writes used to record provider acceptance/failure are unchecked. For example, teacher invitation delivery finalization and lesson-request email submission can fail without escalating to a reconciliation state.
- Some read errors are ignored and interpreted as empty data.
- No automated fault-injection matrix proves transactions remain atomic when a statement fails halfway through.

### Resend

Resend submission uses a custom `ResendRequestError`, provider status/code capture, per-message idempotency keys, durable outbox/delivery tables for several workflows, webhook signature verification, duplicate recognition, and delivery-state reconciliation.

Strengths:

- Provider-facing errors are generally not shown directly to families.
- Billing approval and owner-notification retries are stateful, cooled down, and limited.
- Bounce, complaint, suppression, delayed, delivered, and failed states are modeled.
- Webhooks verify the raw request using Svix headers.

High-risk inconsistencies:

- Delivery durability is not uniform across message types. Teacher invitations and lesson-request emails do not yet use the same fully reconciled dispatch abstraction as owner notification/billing paths.
- A Resend acceptance followed by a failed local update is explicitly handled in some billing paths, but ignored in teacher invitation delivery and counted as accepted in lesson-request dispatch.
- The fallback update in the Resend webhook is not checked for failure.
- There is no explicit request timeout or abort signal on the Resend fetch.
- Fetch-level failures and invalid/non-JSON provider responses become similar errors, and retryability is not classified.
- No centralized suppression check is visible for every message category.

### Twilio

Twilio submission validates credentials, destination format, callback URLs, signatures, account/service identity, and durable inbound/status RPCs. Callback failures log only an error code rather than raw form contents.

Strengths:

- Webhook signatures are validated against the expected callback URL.
- Account and messaging-service bindings are checked.
- Inbound consent events use a payload fingerprint for deduplication.
- Sensitive inbound bodies and phone numbers are not written to console logs by the route handlers.

Gaps:

- The outbound fetch has no explicit timeout/abort policy.
- JSON parsing assumes a JSON provider response; a proxy or malformed response can throw outside the custom error type.
- Configuration helpers can throw before a route reaches its controlled response path, producing an unclassified 500.
- Status normalization and unknown Twilio statuses depend on database behavior and need an explicit forward-compatibility test.
- There is no application-wide retryability classification shared with Resend.

### Stripe

Stripe has the strongest webhook pattern in the current application: raw-body signature verification, support for rotating secrets, durable provider-event intake, atomic claim, duplicate acknowledgement, stale claim recovery, processed/ignored/failed states, and local reconciliation for connected accounts and saved payment methods.

Strengths:

- Provider events are persisted before business processing.
- Duplicate and unsupported events are handled deliberately.
- Failed processing records `last_error` for later inspection.
- Test mode alone may return database detail on intake failure.

Gaps:

- Logging remains unstructured and has no correlation ID, school ID where safely known, deployment version, or alert integration.
- Claim failures return a 500 without logging the underlying database code.
- Failure to update the provider event to `failed` is ignored, leaving possible “processing” ambiguity.
- Provider SDK timeout/retry settings and network-error classification are not documented in the shared policy.
- There is no visible dead-letter/operator queue or scheduled reconciliation worker for repeatedly failed/stale events.
- Test-only error detail in HTTP responses should be explicitly guarded by environment as well as Stripe mode; a production deployment accidentally using test mode should not disclose database messages.

### Webhook and route response contracts

Stripe, Resend, and Twilio routes consistently reject invalid signatures and use appropriate 4xx/5xx responses. Calendar bearer tokens return the same 404 for malformed, revoked, and unknown tokens and include strong privacy/cache headers.

Gaps:

- JSON error bodies use free-form `{ error: string }` with no stable code or request ID.
- Routes do not enforce request body size before reading the full body.
- There is no shared method/content-type/timeout/structured logging wrapper.
- There is no platform-wide replay-age policy documented beyond provider library behavior.
- Health monitoring, backlog alerts, and signature-failure rate alerts are not connected to an observability system.

### Observability and safe logging

Current observability is limited to scattered `console.error` calls and durable domain tables. No centralized logger, error-reporting SDK, trace/correlation system, or alert routing is visible.

Positive practices:

- Twilio callbacks log database codes rather than message contents or phone numbers.
- Resend reconciliation logs event IDs and database codes, not full email payloads.
- Provider errors saved to delivery tables are length-limited in several paths.

Gaps:

- `console.error(error)` can serialize provider SDK or Supabase objects inconsistently and may capture more context than intended.
- Logs have no stable event name/schema, request ID, actor ID, school ID, operation ID, environment, or release identifier.
- Email addresses, phone numbers, bearer tokens, OTP codes, provider secrets, raw webhook payloads, and Stripe objects lack a formally enforced redaction policy.
- Users/support cannot quote an incident reference that maps to logs.
- Durable support incidents exist for a narrow email flow but not for general application errors or reconciliation failures.
- No alert thresholds exist for provider failure rate, webhook backlog, repeated auth failure, database outage, or unhandled exceptions.

## Findings and priorities

### High

#### EH-H01 — Provider acceptance can become locally ambiguous

Affected areas: teacher invitation email, lesson-request email dispatch, Resend webhook fallback, and any provider call whose finalization write is unchecked.

Risk: the provider may accept or deliver a message while Common Time records it as pending/failed/unknown, enabling duplicates, misleading retry controls, or missing support evidence.

Required remediation: route every external side effect through a durable attempt record with `prepared → submitting → accepted/failed → delivered/...` states, check every transition, and move failed finalization into `reconciliation_required`. Never advise retry while acceptance is unknown.

#### EH-H02 — No operational capture or alerting for unexpected errors

Affected areas: all uncaught render/action/route failures and provider reconciliation failures.

Risk: production failures may only exist in transient platform logs or a user’s screenshot. Repeated failures and cross-user patterns may remain invisible.

Required remediation: adopt structured server logging and an error/alert service; attach correlation IDs; alert on unexpected exceptions, webhook failure/backlog, reconciliation-required records, and provider failure-rate thresholds. Define redaction before enabling broad capture.

### Medium

#### EH-M01 — No application error boundaries or designed 404/recovery pages

Add root `global-error.tsx`, root `error.tsx`, authenticated-school `error.tsx`, portal `error.tsx`, and product-specific `not-found.tsx` files. Unexpected fallbacks must offer retry/home/contact actions and show a safe incident reference. Error boundaries must report the exception and never print `error.message` to the user.

#### EH-M02 — Fragmented action error contracts

Replace ad hoc result shapes and new query-string flags with the standard action contract below. Preserve redirects for successful navigation and expired authentication where appropriate, but expected validation/conflict/provider failures should be returned as values.

#### EH-M03 — Database failures are confused with business states

Audit every ignored Supabase `error` and every `.maybeSingle()` branch. Distinguish `not_found`, `forbidden`, `conflict`, `temporarily_unavailable`, and `unexpected`. A failed query must not render “not set up,” “no lessons,” or 404 unless that is the verified state.

#### EH-M04 — Network timeouts and retry policy are undefined

Create provider-specific timeout budgets, bounded SDK/fetch retry policy, and classification for timeout, DNS/network, 429, 4xx rejection, 5xx, malformed response, accepted-but-unreconciled, and terminal suppression. Browser actions need an explicit “connection lost” response and must treat post-submit ambiguity safely.

#### EH-M05 — Generic component fallback is inaccurate

`HoldToConfirm` now supports feature-specific fallback copy. Make that copy required or derive it from a standard action code, audit every call site, and add focus/announcement behavior plus a reset/retry contract.

#### EH-M06 — Auth errors lack consistent classification

Translate Google/OTP/Supabase errors into stable public codes, retain internal diagnostic context, check teacher activation results, and distinguish unavailable auth service from unknown/unprovisioned accounts. Preserve anti-enumeration behavior where required.

#### EH-M07 — No repeatable negative-path suite

Add unit tests for error mapping/contracts, integration tests for RPC/domain errors, route tests for signatures and response codes, and browser tests for offline/double-submit/stale-session/retry behavior. Provider acceptance plus local-finalization failure is a mandatory fixture.

### Low

#### EH-L01 — Loading and partial-data conventions are absent

Define when route-level loading UI is useful, which secondary data may fail independently, and how stale data is labeled. Do not add spinners everywhere; prioritize auth return, portal, school shell, planner, family billing, and notifications.

#### EH-L02 — Status messages are visually and semantically inconsistent

Consolidate inline status, form summary, toast, persistent notification, and durable operator incident components. Match `role="status"` versus `role="alert"` to urgency and move focus for failed form submission when necessary.

## Standard error model

### Taxonomy

Every handled failure should receive one stable code from this public-safe taxonomy:

- `validation_failed` — user input is incomplete or malformed; no mutation occurred.
- `authentication_required` — session absent/expired; safe to reauthenticate.
- `permission_denied` — authenticated actor lacks permission; do not imply absence when the UI needs an explanation.
- `not_found` — resource is genuinely absent or intentionally concealed.
- `conflict` — state changed, duplicate exists, or requested time/resource conflicts.
- `policy_blocked` — business policy disallows the operation.
- `rate_limited` — retry only after a specified time.
- `provider_rejected` — provider definitively did not accept the operation; retryability is explicit.
- `temporarily_unavailable` — database, auth, provider, or network is unavailable before acceptance.
- `reconciliation_required` — external acceptance or local mutation may have occurred; do not retry automatically.
- `unexpected` — invariant violation or bug; capture and show incident reference.

Internal metadata may additionally contain `source` (`client`, `next`, `supabase`, `postgres`, `stripe`, `resend`, `twilio`), provider/SQL code, constraint/RPC name, operation, attempt ID, and cause. Internal metadata must never be serialized to the browser by default.

### Server Action contract

Use one serializable generic result:

```ts
type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | {
      ok: false;
      code: AppErrorCode;
      message: string;
      fieldErrors?: Record<string, string[]>;
      retryable: boolean;
      retryAfterSeconds?: number;
      incidentId?: string;
    };
```

Rules:

- Expected validation, policy, conflict, rate limit, and known provider errors return `ActionResult`; they are not thrown.
- Unexpected exceptions are captured once on the server, assigned an incident ID, and return `unexpected` when recovery in the current UI is possible. Otherwise they are rethrown for the route boundary.
- Never return raw `PostgrestError.message`, Auth error text, provider response bodies, SQL/constraint names, stack traces, or environment details.
- Messages state: what happened, whether the requested change occurred, and the next safe action.
- `retryable: true` means the exact operation is safe to retry. Unknown acceptance must be `reconciliation_required` and `retryable: false`.
- Field errors use stable field names; the form shows a summary and associates each message with its control.
- Successful redirects remain valid when navigation is the outcome. Do not use redirects merely to transport errors that can be rendered in place.

### Route/API error contract

Browser-facing JSON APIs should return:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The request could not be accepted.",
    "requestId": "safe-correlation-id"
  }
}
```

Provider webhook responses may remain deliberately terse, but logs and durable event records must contain the request/event correlation. Use status codes consistently: 400 malformed/signature invalid, 401 unauthenticated, 403 forbidden, 404 concealed/absent, 409 conflict, 415 content type, 429 rate limited, 500 unexpected local failure, 503 required dependency/configuration unavailable.

### Database domain-error contract

Prefer typed RPC result/status values for expected business outcomes. If PostgreSQL exceptions remain necessary, establish a registry of stable machine codes and map by a dedicated field/code—not free-form substring matching. Each entry must specify HTTP/action code, public message, retryability, operator severity, and invariant evidence.

Database availability, RLS denial, uniqueness conflict, missing row, malformed result, and domain-policy refusal are distinct classes. Query helpers must require callers to handle both `data` and `error`.

### User-facing presentation

Build narrow shared primitives:

- `ActionStatus`: inline pending/success/expected error with `aria-live` semantics.
- `FormErrorSummary`: focusable summary plus field links after failed submission.
- `ErrorPanel`: recoverable section failure with retry and safe navigation.
- `IncidentPanel`: unexpected failure with incident ID and support action.
- `EmptyState`: verified absence only; never used for read failure.
- `ProviderState`: owner-facing delivery state, retry eligibility, cooldown, and reconciliation warning without provider jargon unless operationally useful.

Use toast notifications only as a secondary acknowledgement. Any action requiring later work must also create durable state. Never rely on a toast as the sole error record.

### Logging and observability contract

Emit structured events with:

- timestamp, severity, environment, release/deployment, event name, operation, request/correlation ID;
- safe actor/profile ID and school ID when known;
- durable object/attempt/provider-event IDs where relevant;
- error taxonomy code, internal source/code, retryability, and reconciliation state;
- sanitized cause name and stack for unexpected exceptions.

Never log raw secrets, authorization/cookie headers, OTPs, magic links, approval/calendar bearer tokens, full webhook payloads, card/payment method data, arbitrary form bodies, email/SMS content, or full phone/email values. Hash or truncate identifiers only when the support use case requires it. Provider payload storage must follow its separately audited minimum-data policy.

Create alerts for:

- any `reconciliation_required` financial or communication operation;
- Stripe event stuck/failed beyond the recovery window;
- sustained Resend/Twilio rejection, bounce, complaint, or callback failure rate;
- repeated Supabase/Auth/database unavailability;
- unhandled exception rate by release and route;
- webhook signature-failure spikes and event backlog;
- configuration failure at deploy/startup.

### Retry and idempotency rules

- Generate the durable operation and idempotency key before contacting a provider.
- Retry only the same durable operation/key; do not create a new business request merely to retry delivery.
- Disable controls while submitting and guard concurrency again in the database.
- Classify provider 429/5xx/timeouts separately from terminal 4xx, suppression, complaint, or policy failure.
- If the client loses the response after submission, reload status from the durable operation before offering retry.
- Apply bounded exponential backoff with jitter to eligible automated retries and expose manual retry cooldown/limit.
- A provider’s “accepted” response is not delivery, settlement, or local reconciliation.
- Webhooks must be signature-verified, deduplicated, order-aware, durably recorded before business processing, and recoverable after failure.

## Implementation sequence

### Phase 0 — Immediate teacher-flow correction

1. Give teacher creation/invitation a pending state and hold-to-confirm interaction.
2. Return an inline structured result instead of relying only on `?invite=` redirects.
3. Add specific messages for duplicate email, invalid fields, identity provisioning failure, provider rejection, and accepted-but-unreconciled delivery.
4. Ensure invite provider acceptance and its database transition are checked; put ambiguous attempts into reconciliation rather than suggesting immediate resend.
5. Preserve the redirect status vocabulary temporarily for resend/deactivation until the shared contract is available.

### Phase 1 — Foundation

1. Add `src/lib/errors` with taxonomy, `ActionResult`, public translation, cause capture, redaction, and request/incident ID helpers.
2. Add the shared feedback components and make `HoldToConfirm` consume the standard contract with feature-correct fallback copy.
3. Add root/school/portal error boundaries and product-specific not-found UI.
4. Establish structured logging and an error-reporting/alert provider with a reviewed privacy filter.
5. Add environment validation at startup/build boundaries without sending secret values to logs.

### Phase 2 — Migrate highest-risk flows

1. Unify Resend/Twilio dispatch around a durable attempt/reconciliation abstraction.
2. Migrate teacher invites, family lesson requests, billing approval delivery/retry, Stripe onboarding/return, and card setup.
3. Add operator views/alerts for `reconciliation_required`, failed webhooks, and exhausted delivery attempts.
4. Add explicit provider timeouts, retry classification, and local-finalization checks.
5. Remove test-mode database detail from externally reachable Stripe responses unless separately protected by non-production environment.

### Phase 3 — Migrate application forms and reads

1. Migrate auth, school setup, profile/media, lessons, places, products, staff permissions, notifications, and portal calendar actions.
2. Replace query-string error transport with action results; retain query strings only for stable success/return state where useful.
3. Audit every Supabase call for handled error, verified empty state, or intentionally optional data.
4. Replace substring matching with the domain-error registry.
5. Add focused loading and partial-failure UI for slow/high-value routes.

### Phase 4 — Recovery operations and regression gate

1. Add reconciliation workers/runbooks for provider attempts and webhook claims that remain pending/failed.
2. Add dashboard health metrics and alert ownership/escalation.
3. Complete the automated and live test matrix below.
4. Make the error-path suite a release gate for payments, identity, communications, scheduling, and tenant-boundary changes.

## Required test matrix

For every mutation, record whether the action is safe to retry and assert both user-visible state and durable database/provider state.

| Layer | Required cases | Required evidence |
| --- | --- | --- |
| Client/form | invalid fields, keyboard submission, double click/hold, offline before request, connection loss during/after request, back/refresh, stale tab | pending control, accessible error, no duplicate mutation, correct retry instruction |
| Server Action | unauthenticated, unauthorized, malformed identifiers, domain conflict, rate limit, database unavailable, unexpected exception | standard result or boundary; no raw detail; correlation ID for unexpected failure |
| Server render | primary query failure, optional query failure, empty verified data, missing resource, expired session | error boundary/partial state/empty state/404 chosen correctly; retry works |
| Supabase/Auth | OTP invalid/expired, Auth unavailable, account not provisioned, ambiguous payer, membership activation failure, stale claims, RLS denial, cross-school identifier | anti-enumeration preserved where intended; no unauthorized data; accurate next step |
| PostgreSQL/RPC | every domain code, constraint conflict, serialization/concurrency conflict, function exception, malformed/null result, transaction rollback | stable mapping; atomic state; invariant and audit evidence |
| Resend | timeout before acceptance, 400/401, 429, 5xx, malformed response, accepted then local write fails, delayed, delivered, bounce, complaint, suppression, duplicate/out-of-order webhook, invalid signature | one durable attempt/key; correct retry state; reconciliation alert; no duplicate email |
| Twilio | same submission failures as Resend, invalid E.164, accepted then local write fails, status progression/out-of-order status, STOP/START/HELP replay, wrong account/service, invalid signature | consent/delivery state correct and idempotent; safe logs; proper TwiML/status |
| Stripe | SDK timeout, mode/key mismatch, onboarding return sync failure, setup completed/expired, duplicate/out-of-order event, invalid signature, intake DB failure, claim failure, process failure, final status-write failure, stale claim replay | provider/local reconciliation; no duplicate financial effect; failed event visible to operators |
| Calendar route | malformed/unknown/revoked token, RPC failure, empty family, rescheduled/cancelled lesson, cache/proxy behavior | indistinguishable 404 for invalid access; no leak; correct ICS and privacy headers |
| Observability | known validation error, unexpected exception, provider rejection, reconciliation required, webhook backlog, redaction canaries | correct severity/alert; correlation searchable; secrets/PII absent |
| Error UI | phone/tablet/desktop, keyboard, screen reader announcement, reduced motion, 200% zoom, retry success/failure | usable fallback; focus/announcement correct; navigation remains available |

### Mandatory ambiguity scenario

Every provider-backed workflow must pass this sequence:

1. Prepare a durable attempt and idempotency key.
2. Make the provider accept the request.
3. Force the local acceptance/finalization write to fail.
4. Verify the UI does not say “failed, retry now.”
5. Verify the attempt becomes `reconciliation_required` and alerts operators.
6. Reconcile using the provider ID or idempotency key.
7. Verify a user retry cannot create a duplicate side effect.

## Definition of done for a feature

A feature is not error-complete until:

- expected errors use the standard taxonomy/result and plain-language next step;
- unexpected errors reach a designed boundary and structured capture;
- database and provider side effects are atomic or durably reconcilable;
- retryability and idempotency are explicit;
- pending, success, empty, partial, stale, failure, and recovery states are covered where applicable;
- logs pass the redaction policy and an incident can be traced by ID;
- authorization and cross-tenant denial are tested at UI, action/route, RPC, and RLS layers;
- the relevant rows of the test matrix have automated or recorded live evidence;
- this audit log records the run, finding disposition, and remaining risk.

## Audit run template

Append future runs to the audit table and add a dated section containing:

- objective and affected features;
- environment, commit, deployment, actor roles, and fixture IDs (non-sensitive);
- automated, database, browser, provider, and observability checks performed;
- expected versus actual result and durable evidence;
- findings with `EH-<severity><number>` identifiers;
- remediation commit/migration and deployment;
- focused retest evidence;
- deferred cases, owner, target milestone, and residual risk.

Never mark an item passed because a request returned `200`, a toast appeared, or a build succeeded. Verify the application state, database evidence, provider state when applicable, and safe recovery behavior.
