# Decision Log

Use one entry per meaningful technical or product decision.

## Template

### YYYY-MM-DD: Decision Title

- Status: proposed | accepted | superseded
- Context: What forced the decision?
- Decision: What was chosen?
- Consequences: What does this enable or constrain?

## Entries

### 2026-03-10: Create project context scaffold

- Status: accepted
- Context: The repository is starting as a relatively large project with no existing structure.
- Decision: Add a minimal context system for project brief, current status, decisions, work log, and open questions.
- Consequences: Future work has a consistent place for project memory without imposing a heavy process yet.

### 2026-03-10: Target Netlify-hosted Next.js architecture

- Status: superseded
- Context: The project needs to deploy on Netlify, use Next.js, support Google login, and start with a free-friendly database path.
- Decision: Favor a Next.js architecture with operational data in a relational database and defer CMS usage unless a clear content-management need appears.
- Consequences: This keeps the core product centered on application workflows instead of forcing CMS patterns onto scheduling and billing data.

### 2026-03-10: Prefer per-school deployment and database for the first version

- Status: superseded
- Context: The long-term idea may include spinning up isolated instances for multiple music schools.
- Decision: Start with one deployment and one database per school rather than building a shared multi-tenant app first.
- Consequences: The first release stays simpler in auth, data isolation, branding, and support operations, while leaving room for later automation.

### 2026-03-10: Use Square for payment processing integration

- Status: superseded
- Context: The app needs payment processing without building custom card handling from scratch.
- Decision: Keep all checkout and invoice payment experiences in Square-hosted flows and only maintain lightweight associations inside the app.
- Consequences: Payment handling stays simpler, PCI scope remains lower, and the app can focus on scheduling and business operations instead of payment UI.

### 2026-03-10: Treat SMS as an optional but supported communication channel

- Status: proposed
- Context: The product may need lesson reminders, payment reminders, and rescheduling communication by text message.
- Decision: Plan around a dedicated SMS provider instead of trying to rely on payment-platform messaging.
- Consequences: Messaging stays decoupled from billing and can later expand into two-way communication if needed.

### 2026-03-10: Model billables as configurable service types

- Status: proposed
- Context: The app must support lessons, rehearsals, group classes, and space rentals rather than one fixed appointment type.
- Decision: Use a service-catalog model where scheduled events reference configurable service types with pricing and duration rules.
- Consequences: The product can support multiple business offerings without rewriting the billing and scheduling model for each one.

### 2026-08-04: Adopt the Agency Brain platform pattern

- Status: accepted
- Context: The local Agency Brain application provides a working reference for Next.js, Vercel, Supabase SSR authentication, tenant-scoped RLS, invitations, Google login, and Stripe billing.
- Decision: Use the same platform shape for the music application, but create a fresh and smaller domain model rather than copying Agency Brain's business tables.
- Consequences: Core stack choices are resolved and implementation can reuse proven patterns without inheriting unrelated product complexity.

### 2026-08-04: Use true multi-tenancy with explicit school context

- Status: accepted
- Context: The product is intended to serve multiple schools without maintaining a deployment and database for every customer.
- Decision: Use one application and Supabase database, `schools` and `school_members`, `school_id` on tenant-owned rows, RLS isolation, and an explicit selected-school context.
- Consequences: Isolation and authorization require careful policy testing, but onboarding and operations scale much better than per-school deployments.

### 2026-08-04: Separate SaaS billing from school billing

- Status: superseded
- Context: The software vendor may charge schools while schools separately collect lesson payments from families.
- Decision: Use Stripe for school subscriptions to the software and Square-hosted flows for school-to-family invoices and payments.
- Consequences: This two-provider decision was later superseded by the Stripe-only platform decision.

### 2026-08-04: Use Supabase Auth and direct Supabase data access

- Status: accepted
- Context: Agency Brain demonstrates a working Supabase SSR and Google OAuth pattern, making separate Auth.js and ORM layers unnecessary for v1.
- Decision: Use Supabase Auth, Supabase server/browser/admin clients, SQL migrations, RLS, and generated TypeScript database types without an ORM initially.
- Consequences: The architecture has fewer layers, while SQL migration and RLS quality become especially important.

### 2026-08-04: Model scheduling and family billing around monthly service periods

- Status: accepted
- Context: Teachers offer recurring windows by weekday, students need controlled self-service rescheduling, schools define cancellation rules, and lesson scheduling and collection operate monthly.
- Decision: Separate recurring teacher availability, effective-dated lesson enrollments, monthly service periods, materialized scheduled events, and immutable event-change history. Aggregate billable items into monthly processor invoices.
- Consequences: Reschedules and cancellations remain traceable, policy enforcement can be reproduced, and monthly invoices can explain their underlying lessons and adjustments.

### 2026-08-04: Make cancellation policies school-specific and effective-dated

- Status: accepted
- Context: Schools may enforce different notice periods, reschedule limits, late-cancellation charges, no-show rules, and teacher-cancellation remedies.
- Decision: Store structured, effective-dated scheduling policies and preserve the applicable policy result on each cancellation or reschedule.
- Consequences: Policy changes do not alter historical records, and self-service actions can be authorized consistently on both the server and database paths.

### 2026-08-04: Support fixed tuition and monthly usage billing

- Status: accepted
- Context: Some schools charge stable monthly tuition, while others invoice monthly from actual lesson or service occurrences. A school may also offer recurring lessons alongside irregular rentals or rehearsals.
- Decision: Each school selects a default family billing mode of `fixed_monthly` or `monthly_usage`. Individual service agreements may override that default when a school uses both models.
- Consequences: Monthly billing can serve both tuition and usage-driven businesses, while snapshotted terms prevent later configuration changes from rewriting historical charges.

### 2026-08-04: Add a school-level macro calendar

- Status: accepted
- Context: Each school needs to organize terms, closures, holidays, performances, camps, registration windows, and other events that affect or inform lower-level scheduling.
- Decision: Model named school calendar periods separately from dated calendar events. Give each event an explicit visibility and scheduling effect, and evaluate macro calendar restrictions before teacher availability when generating occurrences.
- Consequences: School-wide schedule structure remains distinct from teacher hours and appointments. New closures surface conflicts for explicit resolution rather than silently changing existing lessons or billing.

### 2026-08-04: Standardize payments on Stripe Billing and Connect

- Status: accepted
- Context: Supporting Stripe for SaaS subscriptions and Square for family payments would duplicate SDKs, webhooks, terminology, credentials, sandboxes, and reconciliation. Stripe Connect directly models a SaaS platform whose independent schools remain merchants of record.
- Decision: Use Stripe Billing for schools paying MusicSchool and Stripe Connect direct payments for families paying connected schools. Use Stripe-hosted onboarding and payment surfaces, Stripe-collected processing fees, and Stripe-managed connected-account risk where available.
- Consequences: The platform has one payment ecosystem while keeping software revenue and school revenue logically separate. Schools migrating from Square use an explicit cutoff and families re-enter payment methods without needing Stripe accounts.
