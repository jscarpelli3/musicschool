# Architecture Notes

## Current Recommendation

- Framework: Next.js with App Router
- Hosting: Vercel
- Authentication: Supabase Auth with Google OAuth as the first provider
- Database: Supabase Postgres as the system of record
- Data access: Supabase clients with generated TypeScript types; no ORM initially
- Tenancy: shared application and database with school-scoped rows and Row Level Security
- UI: Tailwind CSS with a reusable dashboard shell
- CMS: Defer Sanity for v1 unless clear content-editing requirements appear
- SaaS billing: Stripe Checkout, customer portal, and webhooks for subscriptions paid by schools
- School billing: Square-hosted invoices and payment links for payments from families
- Messaging: Twilio SMS as the default starting option

This foundation intentionally follows the proven patterns in the local Agency Brain repository while using a fresh, smaller music-school domain model.

## Why Postgres First

- The core product is operational software, not primarily a content platform.
- Scheduling, billing relationships, enrollments, lesson records, and role-based access fit naturally in a relational model.
- A relational database is a better default than a CMS-style document store for constraints, joins, and reporting.

## Why Not Use Sanity As The Main App Database

- Sanity can mutate content and group mutations in transactions, but it is designed as Content Lake infrastructure for structured content and content operations.
- Sanity datasets are closer to content partitions within a Sanity project than a tenant-ready operational database strategy.
- It may still be useful later for editable marketing pages, onboarding copy, policy pages, or reusable email templates.

## Tenancy Direction

- Use one application and one Supabase database for many schools.
- Use `schools` and `school_members` as the tenant and membership boundary.
- Put `school_id` on every tenant-owned operational record and index it.
- Enforce isolation in Supabase Row Level Security, not only in application queries.
- Store the selected school explicitly rather than selecting the first membership, so a user may eventually belong to more than one school safely.
- Start v1 with one active school per ordinary user if school switching is not yet implemented.

## Authentication And Authorization

- Google OAuth is the first login method through Supabase Auth.
- Google login does not grant Gmail or Google Drive access.
- Add separate Google authorization and token storage only if a later feature truly needs Gmail, Calendar, or Drive scopes.
- Initial staff roles: owner, administrator, teacher, and staff.
- Student and guardian permissions are relationship-based and narrower than staff permissions.
- Service-role Supabase credentials remain server-only and are limited to trusted webhooks, background jobs, and administrative operations.

## Product Shape

### Core actors

- School owner
- Teacher
- Student
- Parent, guardian, or account administrator

### Likely v1 entities

- School
- User
- Teacher profile
- Student
- Guardian account
- Student-guardian relationship
- Service category
- Service type
- Scheduled event
- Recurring schedule
- Room or rentable resource
- Invoice or payment record
- Billing profile with Square references
- Theme and branding settings

## Service Catalog Direction

- Do not hardcode billing around lessons only.
- Model a service catalog that can represent:
- private lessons
- rehearsals
- group classes
- space rentals
- Each scheduled item should point to a service type that defines default billing and scheduling parameters.
- Typical service-type parameters:
- category
- default duration
- pricing strategy
- base price
- optional per-unit or per-minute rules
- whether the item is bookable by students or guardians
- whether teacher assignment is required
- whether a room or resource is required

## Scheduling And Billing Model

- Each school owns a macro calendar that defines its terms, closures, holidays, performances, registration windows, camps, and other school-level events.
- A scheduled event should be the operational record for something that happens on the calendar.
- A service type should define the default rules for that event.
- Billing should be derived from the event plus the linked service type configuration, while still allowing explicit overrides when needed.
- Teachers define recurring weekly availability windows in the school's timezone, with dated exceptions for time off and one-off availability.
- Private-lesson commitments are represented by effective-dated enrollments that connect a student, teacher, service type, billing account, and preferred recurring slot.
- Actual lesson occurrences are materialized as scheduled events in monthly schedule periods; recurring rules are never treated as completed appointments by themselves.
- Student or guardian reschedules move an existing occurrence rather than creating an unrelated new lesson. Every change preserves its original time, actor, reason, and policy result.
- Cancellations never delete an event. They record who canceled, when, why, whether the cancellation was timely, and the resulting billing disposition.
- Teacher, student, and room conflicts must be prevented transactionally in Postgres rather than checked only in the interface.

## School Macro Calendar

The macro calendar sits above teacher availability and lesson occurrences:

```text
School calendar periods and events
        ↓
Teacher recurring availability and exceptions
        ↓
Enrollment or service recurrence
        ↓
Individual scheduled events
```

Macro calendar entries can be informational or operational. A recital may appear on calendars without blocking lessons, while a school closure prevents new bookings and affects occurrence generation.

### `school_calendar_periods`

Longer named ranges such as:

- academic year
- semester or term
- summer session
- registration period
- scheduling period

Suggested fields:

- `school_id`
- `name`
- `period_type`
- `starts_on`
- `ends_on`
- `parent_period_id` nullable
- `status`

### `school_calendar_events`

School-level dated or timed entries:

- `school_id`
- `calendar_period_id` nullable
- `event_type`: `closure`, `holiday`, `recital`, `performance`, `camp`, `workshop`, `registration`, `deadline`, or `other`
- `title`
- `description` nullable
- `starts_at`
- `ends_at`
- `all_day`
- `location_id` nullable; null can mean school-wide
- `visibility`: `staff`, `school_community`, or `public`
- `scheduling_effect`: `informational`, `block_new_bookings`, or `closed`
- `created_by_profile_id`
- timestamps

Calendar events should not silently delete or rewrite existing lessons. When a new closure conflicts with materialized events, the application creates a conflict list for staff to resolve through cancellation, rescheduling, credits, or another explicit action. Future occurrence generation skips periods where the resolved macro event blocks scheduling.

Billing consequences still come from the effective cancellation and service-agreement policies. A macro event describes what happened; it does not independently invent a financial adjustment.

## Monthly Operating Cycle

- Scheduling and family billing operate in monthly service periods, normally aligned to the school's local calendar month.
- Each school controls when a future month opens for self-service scheduling and rescheduling.
- A monthly period materializes the expected lesson occurrences from active enrollments and provides the boundary for reschedule limits and billing aggregation.
- Occurrence generation evaluates school macro events before teacher availability, ensuring closures and term boundaries are respected.
- Billing items are generated from the applicable monthly agreement and/or completed, canceled, or adjusted events according to school policy.
- One Square invoice can aggregate multiple billing items for the same billing account and month.
- Square remains the payment processor and invoice delivery system; this application remains the source of truth for lesson entitlement, scheduling changes, and why an amount is owed.

## Family Billing Modes

The product supports both monthly billing approaches:

### Fixed monthly tuition

- The customer owes an agreed monthly amount for an active enrollment or service agreement.
- The amount is not recalculated merely because a calendar month contains a different number of lesson weekdays.
- Cancellation, teacher absence, school closure, credits, and make-up rules determine whether an adjustment is created.

### Monthly usage billing

- The customer is invoiced monthly from actual billable occurrences and adjustments in the service period.
- This is appropriate for irregular lessons, rehearsals, rentals, drop-ins, and other usage-driven services.

Each school selects a default `family_billing_mode`: `fixed_monthly` or `monthly_usage`. An enrollment or service agreement may override the school default so a school can charge fixed tuition for private lessons while billing rentals or irregular services by occurrence.

The resolved billing mode and price terms must be snapshotted for the applicable service period or billing items. Changing a school's default must not retroactively recalculate prior months.

## Scheduling Entities

### `teacher_availability_rules`

- `school_id`
- `teacher_id`
- `weekday`
- `local_start_time`
- `local_end_time`
- `effective_from`
- `effective_until` nullable
- `active`

Rules describe recurring windows such as Mondays from 3:00 PM to 8:00 PM. They do not create lessons.

### `teacher_availability_exceptions`

- `school_id`
- `teacher_id`
- `starts_at`
- `ends_at`
- `exception_type`: `unavailable` or `available`
- `reason` nullable

Exceptions support vacations, closures, performances, and one-off added hours.

### `lesson_enrollments`

- `school_id`
- `student_id`
- `teacher_id`
- `service_type_id`
- `billing_account_id`
- `preferred_weekday`
- `preferred_local_start_time`
- `starts_on`
- `ends_on` nullable
- `status`
- `billing_mode` nullable; falls back to the school default
- monthly tuition or per-occurrence pricing terms

An enrollment expresses the ongoing lesson relationship. It does not replace individual scheduled events.

### `service_periods`

- `school_id`
- `starts_on`
- `ends_on`
- `scheduling_opens_at`
- `scheduling_closes_at` nullable
- `billing_status`
- unique `(school_id, starts_on, ends_on)`

### `service_agreements`

- `school_id`
- `customer_account_id`
- `student_id` nullable
- `service_type_id`
- `billing_mode` nullable; falls back to the school default
- fixed monthly amount or per-occurrence rate
- `starts_on`
- `ends_on` nullable
- `status`

A lesson enrollment may reference a service agreement. Keeping commercial terms in the agreement prevents scheduling records from becoming the sole source of pricing configuration.

### `scheduled_events`

In addition to service, participant, location, and current-time fields, preserve:

- `service_period_id`
- `lesson_enrollment_id` nullable
- `original_starts_at`
- `original_ends_at`
- `starts_at`
- `ends_at`
- `status`
- pricing and policy snapshots needed for historical accuracy

### `event_changes`

- `school_id`
- `scheduled_event_id`
- `change_type`: `rescheduled`, `canceled`, `restored`, or `administrative`
- previous and new start/end values
- `changed_by_profile_id`
- `actor_type`
- `reason`
- `policy_result`
- `created_at`

This is an immutable event history rather than a second source of current schedule state.

## Cancellation And Rescheduling Policy

- Policies are school-specific and effective-dated so changing a policy does not rewrite the meaning of historical cancellations.
- Initial policy fields should include:
- student cancellation cutoff
- student reschedule cutoff
- maximum self-service reschedules per monthly period
- whether reschedules must stay with the assigned teacher
- how far into the future a replacement lesson may move
- late-cancellation billing disposition
- no-show billing disposition
- teacher-cancellation billing disposition
- whether credits or make-up entitlements expire
- Student and guardian permissions still come from their relationship records; satisfying the time policy alone does not grant access.

## Payments

- Keep two payment domains separate.
- Stripe bills a school for its subscription to this software.
- Square should fully own checkout, invoice payment, and payment-method management.
- The app should not collect card details or build an embedded checkout experience in v1.
- The app-side integration should stay minimal:
- store the Square customer reference for the relevant guardian or billing account
- store external invoice or payment-link references when needed
- link users out to Square-hosted pages for payment and invoice management
- This is a strong initial path for private lesson billing because it keeps payment complexity and PCI scope outside the app.

## Proposed V1 Milestone

The first shippable milestone is a single production-ready vertical slice running on the shared multi-tenant foundation:

1. A school owner signs in with Google and creates a school.
2. The owner invites a teacher or administrator.
3. Staff create students, guardians, and their relationships.
4. Staff configure a private-lesson service type and teacher availability.
5. Staff or a guardian schedule, reschedule, or cancel a lesson under defined rules.
6. The system shows a school calendar and a student/household schedule.
7. A billing contact is associated with a Square customer and can follow a Square-hosted invoice or payment link.
8. Tenant isolation, role permissions, audit fields, and core scheduling rules have automated tests.

Rehearsals, group classes, and room rentals remain supported by the service model, but polished workflows for them can follow the private-lesson vertical slice.

## Messaging

- SMS is feasible.
- Twilio is the safest default recommendation for transactional messaging, reminders, and future two-way communication.
- Typical early use cases:
- lesson reminders
- reschedule notifications
- payment reminders
- phone verification or login-related verification later if needed

## UI Direction

- Use a high-contrast dashboard style inspired by trading platforms.
- Support school logo upload.
- Support a constrained theme system with a few brand colors rather than unrestricted design customization.
