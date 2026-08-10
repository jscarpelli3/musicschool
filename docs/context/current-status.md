# Current Status

Production-domain URL, environment, provider-callback, verification, testing, and rollback changes are tracked in [`../operations/domain-cutover.md`](../operations/domain-cutover.md).

## Phase

Owner scheduling and family billing foundation are live in test mode. Payment roadmap Step 8—payer consent and approval-link delivery by SMS—is active while Twilio toll-free verification remains in review.

## Active Focus

1. Complete the real-handset Twilio consent/send/status/STOP/START test after the toll-free sender is approved.
2. Keep the owner planner and payment surfaces reliable on phone, touch-only tablet, keyboard, and desktop.
3. Finish approval delivery and reconciliation before implementing any Stripe charge execution.

## Provider State

- **Supabase:** linked and migrated; tenant, people, scheduling, billing, policy, approval, SMS-consent, and provider-event foundations are deployed with RLS and server authorization.
- **Vercel:** production deployments run at `https://musicschool-alpha.vercel.app`; the custom-domain cutover has not started.
- **Google:** Google OAuth through Supabase is working locally and on the deployed app after correcting provider redirect configuration.
- **Stripe:** Connect is configured in test mode. The first school completed hosted onboarding; test card setup, attachment, detachment, Connect synchronization, and signed webhook intake have been exercised.
- **Twilio:** account, Messaging Service, scoped credentials, inbound/fallback/status URLs, and Advanced Opt-Out copy are configured. Toll-free verification remains in review, so live handset delivery is not yet an acceptance-tested capability.

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

- Toll-free approval and one complete real-phone Twilio test are still required. The configured Messaging Service validity period should be rechecked before launch; it was observed as 36,000 seconds and no final change was confirmed.
- No production or test charge-execution workflow is active yet. Approval, saved-card authorization, and collection remain deliberately separate.
- The first real school needs published cancellation/payment policies before months containing cancellations or no-shows can produce complete drafts.
- Teacher-only and guardian/student rescheduling flows are deferred. Their authorization and policy limits must not be inferred from the owner flow.
- Macro calendar closures and dated teacher exceptions are modeled but still need enforcement before client self-service rescheduling launches.
- Phone day view defaults to one teacher and phone month view summarizes counts. Week view remains deliberately horizontally scrollable; an agenda or paged-day treatment is a future refinement.
- A paid Supabase backup plan and tested Storage export/restore procedure remain production-readiness requirements.

## Next Steps

1. When Twilio approval arrives, run the payer phone → web consent → owner send → handset receipt → delivery callback → STOP block → START restore acceptance sequence and append the evidence.
2. Close Payment Step 8 only after retries, failure visibility, consent enforcement, and duplicate prevention pass that live sequence.
3. Implement Stripe charge execution against an approved, locked, current request with idempotency, receipts, refunds/disputes, and reconciliation.
4. Rehearse the planner/reschedule flow under a teacher-only account, then design policy-bound guardian/student access and magic-link delivery.
5. Choose the final brand/domain, then execute [`../operations/domain-cutover.md`](../operations/domain-cutover.md) without removing the Vercel alias until the rollback window closes.

## Updated

2026-08-09
