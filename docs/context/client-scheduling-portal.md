# Client Scheduling Portal

## Status

Agreed V1 direction as of 2026-08-18. The passwordless read-only portal foundation was implemented on 2026-08-19; cancellation mutations have not started.

## Product Boundary

V1 payment management remains owner-mediated. Families will not receive a payment portal, password account, or long-lived payment-management bearer link. Client self-service begins with lesson cancellation and reschedule requests only.

## Passwordless Access

- Stable entry point: `/portal`.
- The client enters the email address recorded by the school.
- Supabase Auth sends a one-time email code.
- The verified email receives a normal session; there is no password to create or remember.
- Authorization is resolved dynamically from the verified email to active student-contact and billing-account relationships.
- An unknown or no-longer-authorized email exposes no school, student, family, or lesson information.
- Reminder links may deep-link to a lesson, but the URL itself grants no access. An unauthenticated client completes the email-code flow and returns to the requested lesson.
- Google OAuth may remain an optional convenience. V1 does not require Apple, Amazon, multiple social providers, SMS OTP, or hand-rolled authentication.

## Portal Schedule

- Show scheduled lessons belonging to the client’s authorized students from today through three months ahead.
- Never infer access from a guessed lesson, student, school, or billing-account ID.
- Preserve school timezone when displaying deadlines and lesson times.
- Cancellation is consequential and requires an explicit confirmation interaction.

## Cancellation Truth

The client-facing explanation for a late cancellation may say that the lesson is charged as a serviced lesson because that is straightforward language for the family. Internal records must remain precise:

- Outcome: student cancelled.
- Timing: timely or late.
- Billing disposition: resolved from the applicable published cancellation-policy version.
- A late charged cancellation is never stored as completed service.

### Timely Or Otherwise Eligible Cancellation

- Atomically record the cancellation, actor, time, applicable policy version, and resolved billing/service disposition.
- Remove the occurrence from active scheduling without deleting or rewriting its history.
- When policy says replacement service remains owed, create exactly one lesson entitlement in the student’s `Lessons to schedule` pool.
- Notify the client, assigned teacher, and active owner/admin recipients by durable email records.
- Create durable in-app notifications and live toasts for the assigned teacher and owner/admin recipients.

### Late Or Otherwise Ineligible Cancellation

- Atomically record a late student cancellation and the applicable policy evidence.
- Clearly tell the client that the cancellation was too close to the lesson and remains chargeable under the school’s policy.
- Do not create a lesson entitlement unless the policy explicitly permits one.
- Send the same client, assigned-teacher, and owner/admin email and in-app notifications.

### Already-Paid Eligible Lesson

- Record cancellation truth first.
- Offer `Request another time` or `Request account credit` as a follow-up choice.
- A service entitlement and a dollar account credit are different things.
- Until the durable financial account-credit ledger exists, a credit choice creates an auditable owner follow-up request; it must not fabricate or silently apply money.

## Reschedule Requests

- A client request does not immediately move or cancel the existing occurrence.
- The current lesson remains authoritative until the owner accepts a valid replacement.
- The owner must resolve teacher availability, place availability, collision checks, and policy restrictions before confirming the new occurrence.
- If the existing occurrence is actually cancelled while replacement service remains owed, its entitlement enters the student’s pool.

## Lessons To Schedule

`Lessons to schedule` is the client- and owner-facing name for service entitlements that have no scheduled occurrence. Avoid treating them as editable historical lessons or as dollar credits.

Each entitlement should record:

- School and family billing account.
- Origin lesson occurrence and original student.
- Current student entitled to receive the service.
- Lesson product/type and duration.
- Teacher and location restrictions when applicable.
- Policy version and reason that created the entitlement.
- Creation, expiration, reservation, scheduling, forfeiture, and transfer timestamps as applicable.
- Current status such as `available`, `reserved`, `scheduled`, `expired`, or `forfeited`.
- Immutable transfer and scheduling history.

The originating occurrence remains attached to its original student and cancellation history. Scheduling consumes the entitlement atomically and creates a new occurrence linked back to the entitlement. An entitlement cannot be scheduled or transferred twice.

## Within-Family Transfers

- V1 transfer is owner/admin only.
- The current beneficiary may be changed only to another student on the same billing account.
- Example: cancel Joey’s eligible lesson, create one entitlement in Joey’s pool, transfer that entitlement to Jenny, then schedule a new occurrence for Jenny.
- Never rewrite Joey’s original occurrence as Jenny’s lesson.
- Record the original student, prior beneficiary, new beneficiary, actor, time, and reason in append-only transfer evidence.
- Transfers are reversible only through another recorded transfer.
- Require compatible product/type, duration, and restrictions by default. Cross-product or unequal-duration conversion needs a later explicit conversion workflow and must not happen silently.

## Notification Matrix

For both timely and late client cancellations:

| Recipient | Email | In-app notification/toast |
| --- | --- | --- |
| Client/contact | Required | Portal confirmation is sufficient for V1 |
| Assigned teacher | Required | Required |
| Active owner/admin | Required | Required |

Notification delivery failure must not roll back or obscure the cancellation. Cancellation truth and notification delivery remain separate, durable, retryable records.

## Core Invariants

- No password is required.
- No permanent public URL grants family access.
- Authorization comes from a verified session plus current family/student relationships.
- Historical occurrences are immutable in identity and ownership.
- Cancellation policy is structured, published, effective-dated, and snapshotted in the decision evidence.
- A late charged cancellation is not completed service.
- A lesson entitlement is not a dollar credit.
- Transfer never crosses billing accounts in V1.
- Scheduling or transfer cannot duplicate an entitlement.
- No client cancellation, request, or notification initiates a payment.

## Implementation Sequence

1. Add `/portal` email-code authentication and session return flow.
2. Add dynamic verified-email-to-contact authorization and next-three-month lesson query.
3. Add policy preview and atomic client cancellation mutation.
4. Add durable client, teacher, and owner/admin notification fan-out.
5. Add lesson-entitlement pool and eligible-cancellation issuance.
6. Add owner scheduling from an entitlement.
7. Add same-billing-account entitlement transfer with append-only history.
8. Add reschedule and account-credit follow-up requests.
9. Rehearse cross-tenant denial, stale sessions, duplicate submission, late/timely boundaries, paid/unpaid states, notification failure, transfer compatibility, and concurrent scheduling.

## 2026-08-19 Foundation Checkpoint

- Added `/portal` email one-time-code request and verification UI using Supabase Auth. Responses do not disclose whether an email has family access.
- Added a security-definer portal schedule function that derives authorization only from the authenticated JWT email, active contact records, current `student_contacts`, and active/paused student enrollment.
- Family sessions receive no direct access to school, people, contact, student, or lesson tables and are not made school members.
- The read-only portal shows scheduled lessons from the current instant through three months ahead with school timezone, student, teacher, offering, and place context.
- Unknown, inactive, or unlinked verified emails receive an empty schedule rather than tenant details.
- Migration `20260819100000` is deployed; linked database lint reports no new issues. TypeScript and ESLint pass.
- Before live code-entry acceptance, configure the hosted Supabase email template to render the one-time token rather than only a magic-link confirmation URL. Cancellation controls remain intentionally absent until this access boundary passes live authorization tests.

## 2026-08-19 Security Hardening Checkpoint — Pending Deployment

- The foundation checkpoint above records the originally deployed behavior and is superseded by this design once the pending migrations deploy.
- Portal authorization is payer-specific: a private authorization binds one normalized email to one active billing account per school. The same email may independently authorize payer accounts at different schools.
- General `student_contacts` relationships no longer grant portal schedule access. Lessons are reached only through the authorized billing account's `billing_account_students` assignments.
- Separate active payer accounts in one school may not share an email. Existing ambiguous data is denied and receives a contact-the-school state rather than combined family data.
- Owners/admins silently provision the passwordless Auth identity when maintaining a payer email. Portal requests cannot create Auth identities and therefore never invoke the signup flow.
- Access states are explicit and server-derived: `not_setup`, `ambiguous`, and `ready`. Only `ready` can execute the lesson query; a ready payer with no scheduled lessons retains the legitimate empty state.
- Payer email changes transactionally update only that school's payer authorization. An old-email session loses this access while retaining any independent access at other schools.
- Full findings, controls, validation evidence, unresolved abuse risk, and deployment gates are recorded in `docs/audits/security-audit-log.md` under `SEC-AUDIT-2026-08-19-001`.

## Reusable Calendar Presentation

- The read-only portal schedule uses the shared `CalendarRange` primitive and `LessonCalendar` composition rather than route-specific calendar markup or date arithmetic.
- The calendar derives all displayed months and day placement from a rolling range, item timestamps, and the school's IANA timezone. It includes partial boundary months automatically and does not contain hardcoded month layouts.
- A payer attached to multiple schools receives separate calendars so lessons are never grouped under the wrong timezone.
- Phone uses a compact monthly agenda from the same grouped data; tablet and desktop use a seven-day month grid. Neither representation requires hover or separate business logic.
- Styling uses the established Tailwind tokens and utilities. No calendar-specific inline styles or parallel CSS system was introduced.

## Private Calendar Subscription

- The primary calendar handoff is a subscription rather than repeated bulk imports. Each school/family billing account receives its own feed so school names and timezones never cross calendar boundaries.
- A subscription uses a 256-bit random bearer token. Only its SHA-256 digest is stored. The credential grants read-only access to calendar-safe lesson fields for one active billing account; it grants no portal, payer, contact, or payment access.
- Creating a replacement link atomically revokes the old link. Families can also revoke access directly. A payer email/billing-contact authorization change revokes the existing link so possession by the old contact does not preserve access.
- Calendar events use the immutable lesson occurrence ID as a stable iCalendar UID. Time changes increase the event sequence, while cancelled or rescheduled occurrences remain in the feed temporarily with `STATUS:CANCELLED`; this lets subscribed calendars update instead of creating duplicates or retaining stale lessons.
- The feed includes scheduled occurrences up to twelve months ahead and retains cancelled/rescheduled evidence for six months. The portal UI may continue to show a shorter three-month working window.
- Apple-style calendar handlers can open the `webcal` subscription directly. Google Calendar and Outlook web users can copy the HTTPS feed URL into their provider's subscription-from-URL flow. Provider polling is outside Common Time's control and changes may take hours to appear.
- The raw link is shown only when created or replaced and must be treated as private. Existing active status is visible later, but the raw token cannot be recovered from the database.
