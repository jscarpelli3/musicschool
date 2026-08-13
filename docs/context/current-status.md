# Current Status

Production-domain URL, environment, provider-callback, verification, testing, and rollback changes are tracked in [`../operations/domain-cutover.md`](../operations/domain-cutover.md).

## Phase

Owner scheduling and family billing foundation are live in test mode. Payment roadmap Step 8 now delivers approval links by included transactional email; SMS has moved to an optional per-school add-on.

## Active Focus

1. Implement durable transactional-email approval delivery and provider reconciliation through Resend.
2. Keep the owner planner and payment surfaces reliable on phone, touch-only tablet, keyboard, and desktop.
3. Finish approval delivery and reconciliation before implementing any Stripe charge execution.

## Provider State

- **Supabase:** linked and migrated; tenant, people, scheduling, billing, policy, approval, SMS-consent, and provider-event foundations are deployed with RLS and server authorization.
- **Vercel/domain:** `commontime.studio` is owned and connected. Host-aware routing is implemented: apex redirects to `www`, `www` serves a public Coming Soon page, and `app`/legacy application hosts are explicitly noindex. `app.commontime.studio` and `www.commontime.studio` still need to be attached and validated in Vercel before the controlled provider cutover.
- **Google:** Google OAuth through Supabase is working locally and on the deployed app after correcting provider redirect configuration.
- **Stripe:** Connect is configured in test mode. The first school completed hosted onboarding; test card setup, attachment, detachment, Connect synchronization, and signed webhook intake have been exercised.
- **Transactional email:** Resend is the selected first provider but is not configured or implemented yet. Common Time will send from one authenticated platform domain while displaying the school identity and reply-to address.
- **Twilio:** the initial generic MusicSchool toll-free submission was rejected because it did not identify one end business, pointed reviewers into a login-protected app, and presented consent as reusable across schools/programs. The shared-sender implementation remains test foundation only; production SMS requires one isolated subaccount, number, verification, and consent program per add-on school.

## Implemented Product Foundation

- Lean Next.js App Router application with Supabase SSR, Google OAuth, school-scoped tenancy, role-aware authorization, and private avatar/logo storage.
- Owner School Setup for information, lessons/classes, spaces, versioned policies/documents, and staff.
- Demo school data with three teachers, 12 students, family/payer relationships, availability, recurring schedules, and varied lesson outcomes.
- Owner day/week/month planner, split availability, lesson details, structured places, single-lesson rescheduling, immutable change history, collision protection, and explicit reschedule permissions.
- Family billing accounts, immutable occurrence pricing, monthly draft generation, review blockers, three/four/five-week handling, fixed-monthly handling, and hold-to-lock review.
- Stripe Connect account state, hosted payer card setup, saved-method reconciliation, signed/idempotent provider-event intake, and disconnect handling.
- Expiring single-use approval requests bound to exact locked periods; public hold-to-approve flow remains separate from collection.
- Public SMS enrollment, append-only consent evidence, durable delivery/status ledgers, owner approval-link send action, signed callbacks, inbound STOP/START/HELP synchronization, and provider-safe retry behavior.

## Current Gates And Known Gaps

- The current toll-free number is restricted and cannot complete a real US/Canada handset test. It can be assigned to the first school and resubmitted after school-specific business and public consent materials exist; no second number is needed merely to continue software testing.
- The Twilio parent account still needs an approved ISV Primary Customer Profile before production per-school onboarding. The configured Messaging Service validity period should also be explicitly chosen rather than inheriting the observed 36,000-second value.
- No production or test charge-execution workflow is active yet. Approval, saved-card authorization, and collection remain deliberately separate.
- The first real school needs published cancellation/payment policies before months containing cancellations or no-shows can produce complete drafts.
- Teacher-only and guardian/student rescheduling flows are deferred. Their authorization and policy limits must not be inferred from the owner flow.
- Macro calendar closures and dated teacher exceptions are modeled but still need enforcement before client self-service rescheduling launches.
- Phone day view defaults to one teacher and phone month view summarizes counts. Week view remains deliberately horizontally scrollable; an agenda or paged-day treatment is a future refinement.
- A paid Supabase backup plan and tested Storage export/restore procedure remain production-readiness requirements.

## Next Steps

1. Create the Resend account/domain configuration and implement payer email plus durable email-delivery reconciliation.
2. Close Payment Step 8 only after email retries, provider failure visibility, bounce/complaint suppression, supersession, and duplicate prevention pass an end-to-end approval sequence.
3. Implement Stripe charge execution against an approved, locked, current request with idempotency, receipts, refunds/disputes, and reconciliation.
4. Rehearse the planner/reschedule flow under a teacher-only account, then design policy-bound guardian/student access and magic-link delivery.
5. If the first school purchases SMS, create its fixed public consent/business page, assign the current toll-free number exclusively to it, and resubmit with exact end-business information.
6. Add and validate `app.commontime.studio`, establish the Resend sending subdomain, then execute [`../operations/domain-cutover.md`](../operations/domain-cutover.md) without removing the Vercel alias until the rollback window closes.
7. Build `www.commontime.studio` as the marketing/public-policy surface and redirect the apex there before public launch.

## Updated

2026-08-09
