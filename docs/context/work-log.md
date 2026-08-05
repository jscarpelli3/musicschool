# Work Log

Use this file for short chronological notes about meaningful work.

## 2026-08-04

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
