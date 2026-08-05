# Work Log

Use this file for short chronological notes about meaningful work.

## 2026-08-05

- Deployed teacher availability rules and scheduled lesson occurrences, then populated seven weeks of demo lessons for all 12 students.
- Replaced the school foundation placeholder with an owner planner offering day, week, and month views, teacher filters, open-time fields, booked lessons, and occupancy lines.
- Added expanding availability fields and steeply angled teacher labels to distinguish overlapping teacher windows without obscuring booked lessons.
- Made planner expansion teacher-scoped: the active teacher's availability and lessons expand together while other teachers' lessons retain their width beneath the active layer; doubled the angled teacher-label size.
- Made lesson occurrences clickable in every planner view and added an in-context detail sheet for lesson, teacher, student, guardian, and billing-payer information.
- Pinned angled teacher labels entirely above availability fields and added one-second delayed lesson quick views for student name and time.
- Raised hovered lessons above every planner layer, extracted delayed quick views into a reusable UI primitive, and formalized component/modularity requirements in `code-rules.md`.
- Simplified lesson blocks to responsive student names, moved time and place into delayed quick views, and deployed structured school-room, student-home, and custom lesson locations.
- Changed inactive teacher availability to compress into persistent hoverable rails with fading labels, allowing expansion to transfer fluidly across a calendar column.
- Moved compressed teacher rails to their corresponding outer edges and sized the active availability and lesson fields to the space remaining between them.
- Scoped teacher compression to the active day only, reduced inactive rails to exactly four pixels, and made lesson occurrences collapse and expand with their teacher's availability field.
- Replaced hard-coded lesson location categories with a reusable school-owned Places list, migrated existing occurrences, and added owner/admin/teacher place management.
- Added lesson duration to the delayed calendar quick view alongside the time range and place.
- Enforced non-overlapping teacher availability while preserving multiple same-day blocks, and added split Wednesday hours to the demo owner schedule.

## 2026-08-04

- Added a semantic Tailwind configuration for centralized colors, radii, spacing, typography, and shadows.
- Added private profile-avatar and school-logo storage design, upload actions, signed image display, and tenant-aware Storage RLS policies.
- Defined an anti-template design brief and added a temporary `/design` typography study comparing Newsreader, Bricolage Grotesque, and IBM Plex Sans.
- Reworked the typography study into dark charcoal, aged-oak, and blackened-bronze material variations to match the selected visual atmosphere.
- Added a live interaction study and reusable line-based grammar for hover, focus, selectors, connected data, progress, and accessible hold-to-confirm actions.
- Replaced the typography study's one-off colors with the same semantic dark material tokens used by the production interface.
- Deployed private media storage plus the school-scoped people, teacher, student, family-contact, and billing-account foundation.
- Seeded the first school with three teachers including the owner, 12 students, eight guardian payers, two self-paying students, two multi-student families, and ten billing accounts.
- Deployed the school service-product catalog and added an owner/admin setup screen for private lessons and group classes with duration, cadence, pricing, and capacity controls.

- Reviewed the local Agency Brain repository as a read-only architecture reference.
- Adopted Next.js, Vercel, Supabase Auth/Postgres/RLS, Google OAuth, and a shared multi-tenant database as the platform direction.
- Initially separated Stripe SaaS subscription billing from Square-hosted family payments; this was later superseded by Stripe-only billing.
- Defined the first shippable milestone as a private-lesson scheduling and billing-link vertical slice.
- Added an account and provider setup checklist.
- Scaffolded a lean Next.js 16 App Router application with TypeScript, Tailwind CSS, and ESLint.
- Installed only the Supabase JavaScript and SSR runtime packages beyond the framework dependencies.
- Added current browser/server Supabase clients and a Next.js session-refresh proxy.
- Initialized the local Supabase CLI directory and verified the project URL and publishable key against the Auth API.
- Confirmed Google authentication is not yet enabled in the Supabase project.
- Authenticated the Supabase CLI and linked the local repository to the `MusicSchool` project in the West US region.
- Defined recurring teacher availability, dated exceptions, lesson enrollments, monthly service periods, materialized lesson occurrences, and immutable event-change history as the scheduling foundation.
- Established school-specific, effective-dated cancellation and rescheduling policies and monthly aggregation of family billing items into processor invoices.
- Accepted both fixed monthly tuition and monthly usage billing, with a school default and optional service-agreement override.
- Added a school macro calendar for terms, closures, holidays, performances, camps, registration windows, and other school-level events with explicit scheduling effects.
- Deployed the identity and tenancy foundation to Supabase: profiles, schools, memberships, audit records, helper functions, RLS policies, and atomic owner onboarding.
- Added column-level privilege restrictions and confirmed the deployed schema passes Supabase database linting.
- Generated database types and implemented Google login, OAuth callback, sign-out, school setup, multi-school selection, and a protected school dashboard.
- Verified TypeScript, ESLint, the production build, unauthenticated route redirects, and anonymous denial of the school-creation RPC.
- Standardized payments on Stripe Billing and Stripe Connect, with direct school payments and a lightweight Square-to-Stripe cutoff plan for the first school.

## 2026-03-10

- Created initial repository context files.
- Established a lightweight documentation structure for planning and ongoing execution.
- Captured the first high-level product brief for a private lesson music business platform.
- Recorded initial architecture direction and open questions around tenancy, CMS fit, and database choice.
- Added payment-processing direction with Square and noted self-service scheduling requirements for students and guardians.
- Added SMS as a supported future communication channel and recorded related architecture questions.
- Clarified that Square should own all checkout and invoice management experiences, with this app only maintaining minimal external associations.
- Expanded the domain model to include configurable billable service types such as lessons, rehearsals, group classes, and space rentals.
