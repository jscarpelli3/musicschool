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

- A scheduled event should be the operational record for something that happens on the calendar.
- A service type should define the default rules for that event.
- Billing should be derived from the event plus the linked service type configuration, while still allowing explicit overrides when needed.

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
