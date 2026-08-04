# Work Log

Use this file for short chronological notes about meaningful work.

## 2026-08-04

- Reviewed the local Agency Brain repository as a read-only architecture reference.
- Adopted Next.js, Vercel, Supabase Auth/Postgres/RLS, Google OAuth, and a shared multi-tenant database as the platform direction.
- Separated Stripe SaaS subscription billing from Square-hosted family payments.
- Defined the first shippable milestone as a private-lesson scheduling and billing-link vertical slice.
- Added an account and provider setup checklist.
- Scaffolded a lean Next.js 16 App Router application with TypeScript, Tailwind CSS, and ESLint.
- Installed only the Supabase JavaScript and SSR runtime packages beyond the framework dependencies.
- Added current browser/server Supabase clients and a Next.js session-refresh proxy.
- Initialized the local Supabase CLI directory and verified the project URL and publishable key against the Auth API.
- Confirmed Google authentication is not yet enabled in the Supabase project.
- Authenticated the Supabase CLI and linked the local repository to the `MusicSchool` project in the West US region.

## 2026-03-10

- Created initial repository context files.
- Established a lightweight documentation structure for planning and ongoing execution.
- Captured the first high-level product brief for a private lesson music business platform.
- Recorded initial architecture direction and open questions around tenancy, CMS fit, and database choice.
- Added payment-processing direction with Square and noted self-service scheduling requirements for students and guardians.
- Added SMS as a supported future communication channel and recorded related architecture questions.
- Clarified that Square should own all checkout and invoice management experiences, with this app only maintaining minimal external associations.
- Expanded the domain model to include configurable billable service types such as lessons, rehearsals, group classes, and space rentals.
