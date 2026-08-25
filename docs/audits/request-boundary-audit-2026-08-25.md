# Request-boundary audit — 2026-08-25

This review inventories the application-controlled HTTP and Server Action boundaries as of 2026-08-25. It distinguishes browser-origin validation, authentication, tenant authorization, input validation, database authorization/RLS, provider signatures, replay controls, and throttling. A browser check is defense in depth; it is never treated as tenant authorization.

## Shared boundary model

- `proxy.ts` rejects unrecognized production hosts and rejects every unsafe browser method without an approved `Origin`/Fetch Metadata value. Provider webhook paths are excluded because their callers are not browsers.
- Next.js Server Actions retain the framework's built-in Origin/Host comparison. Sensitive public and high-impact actions also call `protectServerAction`, which performs an explicit origin check and a durable, atomic database rate-limit check.
- Authenticated actions resolve the current signed Supabase claims server-side. School/customer/teacher ownership is re-resolved by a school-scoped query or `SECURITY DEFINER` RPC. RPCs enforce authorization and RLS/grants backstop direct-table access.
- Stripe, Resend/Svix, and Twilio endpoints validate raw-body provider signatures. Twilio additionally verifies the expected account/service. Provider payload sizes are bounded before parsing.
- Public bearer links validate token syntax, store only token digests in durable state, rate-limit by a keyed digest plus source IP, and authorize the requested record inside a database function.
- Rate-limit identifiers are HMAC digests. Raw email addresses, tokens, and IP addresses are not stored in the rate-limit table.

## Route Handler inventory

| Boundary | Caller proof | Resource/scope proof | Abuse/replay controls | Status |
|---|---|---|---|---|
| `GET /auth/callback` | Supabase OAuth PKCE code exchange | Safe same-origin relative `next`; membership activation binds `auth.uid()` | Provider code is single-use | Covered; add explicit callback burst telemetry later |
| `POST /auth/signout` | Central browser Origin gate + explicit route Origin check + session cookie | Signs out only the current Supabase client session | No material repeated side effect | Covered |
| `GET /payments/return` | Authenticated claims | Server checks active school role and connection state | Read/reconcile path; Stripe object scope remains server-side | Covered structurally; provider fault matrix remains open |
| `GET /api/calendar/[token]` | High-entropy bearer token | Service-role RPC hashes token and resolves active payer authorization | Syntax check, durable token/IP throttle, revocation/replacement, no-store | Covered; provider/device rehearsal remains open |
| `POST /api/stripe/webhooks` | Stripe raw-body signature | Connected-account/provider objects resolved against durable school bindings | 1 MiB limit; durable event claim/idempotency/replay state | Covered structurally; full Stripe regression suite remains open |
| `POST /api/resend/webhooks` | Svix raw-body timestamp/signature | Provider email ID resolves durable delivery records | 256 KiB limit; provider event dedupe; signed status reconciliation | Improved; unified reconciliation for older invite/request outboxes remains open |
| `POST /api/twilio/incoming` and fallback | Twilio form signature | Expected account and messaging service | 64 KiB limit; message SID/fingerprint dedupe | Covered structurally |
| `POST /api/twilio/status` | Twilio form signature | Expected account and known message SID at DB transition | 64 KiB limit; event fingerprint/state validation | Covered structurally |

## Server Action inventory

The central unsafe-method gate and Next Server Action validation cover every action below before application code runs. Database authorization is authoritative.

| Area/actions | Authentication and tenant/customer boundary | Input/side-effect controls | Additional throttle |
|---|---|---|---|
| Login and portal OTP request/verify | Server-side Supabase Auth; portal preflight uses private payer authorization state | Normalized email/code; no account creation; cookies established server-side | 5 sends/15 min and 10 verifies/15 min per email+IP |
| Lesson create; dashboard/teacher reschedule | Active claims plus exact owner/admin or assigned-teacher RPC checks | UUID/enums/length/date checks; conflicts and school ownership rechecked in locked DB transaction | Lesson create 30/10 min per actor+school+IP; reschedule-specific throttle pending |
| Portal change preview/submit | Active payer Auth identity; RPC binds current email to one active school/account/student/lesson | Enum/UUID checks; policy snapshot and request are atomic; lesson is not directly changed | Preview 30/10 min; submit 5/hour per actor+lesson+IP |
| Billing approval/rejection/mandate | Scoped bearer token; database hashes token and locks exact request/account | Enum/length/value constraints; idempotent state transitions and immutable evidence | 10/15 min per action+token+IP |
| Billing draft/send/retry/adjustments/payment method | Active claims plus owner/admin RPC and tenant-composite identifiers | Server-derived recipient/amount/provider ownership; durable provider attempts | Provider retry caps exist; general owner financial mutation throttle remains open |
| Teacher invite/access/settings/instruments/availability | Active owner claim; school/teacher identity checked by RPC | Email/name/instrument/time validation; durable invite record | Invite send throttle remains open |
| Profile/avatar | Active claim; storage path is derived from `auth.uid()` and Storage policy | MIME/size/image checks; upload cleanup semantics | Upload throttle remains open |
| School/products/places/setup/notifications | Active role plus school-scoped RPC/RLS | UUID/enums/length/state checks vary by action | Low-risk general mutation throttle remains open |
| Portal calendar rotate/revoke | Active payer claim; school account resolved by RPC | Token generated server-side; old token revoked atomically | 5 rotate/hour, 10 revoke/hour |
| Public SMS consent | Browser Origin gate; no authenticated identity | Honeypot, normalized E.164, required consent, DB evidence | 5/hour per phone+IP |

## Findings and remaining work

1. **High, partially remediated:** email delivery schemas are inconsistent. New lesson-created email intent is transactionally queued and has an explicit unknown-provider-outcome state. Teacher invitation and family lesson-request delivery still need migration into the unified communication/attempt/event model and full Resend webhook reconciliation.
2. **Medium, open:** owner financial, teacher invite, avatar, reschedule, and general management actions inherit origin/auth/RPC/RLS protection but do not all have action-specific durable rate limits. Add limits based on business impact and test normal bulk workflows before enabling them.
3. **Medium, open:** Supabase hosted Auth rate limits, session duration/inactivity policy, refresh-token reuse detection, and CAPTCHA escalation thresholds are deployment configuration. Record and test their exact production values; do not rate-limit ordinary valid session refreshes so tightly that legitimate navigation fails.
4. **Medium, open:** a single-node HMAC/IP limiter is durable in Postgres, but forwarded-IP trust depends on the deployment proxy. Confirm Vercel's header normalization and test spoofed forwarding headers at the public edge.
5. **Medium, open:** add structured security-event capture and alerts for sustained throttles, signature failures, unknown hosts/origins, reconciliation-required email attempts, and provider webhook processing failures.
6. **Low, open:** OAuth initiation remains client-driven, protected by Supabase PKCE/state. Add a short initiation throttle only if live telemetry shows abuse; avoid creating friction with no demonstrated benefit.

## Required adversarial retest

- Cross-origin form/fetch and forged Host against every unsafe browser route; verify `403/421` before any database/provider side effect.
- Anonymous, inactive, wrong-role, same-role-other-school, other-family, other-teacher, guessed UUID, and stale-session attempts for each action family.
- OTP send/verify bursts, concurrent attempts, different-IP attempts, and cooldown recovery without storing raw identifiers.
- Approval and lesson-change replay/concurrency at and beyond limits; prove existing idempotent responses remain usable and no partial mutation occurs.
- Forged, stale, duplicated, out-of-order, oversized, and valid Stripe/Resend/Twilio webhook payloads.
- Provider acceptance followed by local-finalization failure for every email kind; prove unsafe retry is disabled until reconciliation.

