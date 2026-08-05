# Project Brief

## Purpose

Build a multi-tenant web application for small private-lesson music businesses, deployed on Vercel.
Each school is an isolated tenant. A school owner can manage multiple teachers and may also teach.
The system needs to manage students, the adults or administrators responsible for scheduling and billing, and the operational workflows around lessons.
The system also needs to support multiple kinds of billable offerings, including private lessons, rehearsals, group classes, and space rentals.
The product should support multiple schools in one application while keeping each school's data isolated.

## Goals

- [x] Define the primary user or audience
- [x] Define the main problem being solved
- [x] Define the initial version or milestone
- [ ] Support Google login at minimum
- [ ] Use a database with a free-friendly starting path
- [ ] Allow light branding such as logo upload and color theme selection
- [ ] Integrate Stripe Billing and Stripe Connect for payment processing
- [ ] Allow students and guardians to log in and self-manage lesson scheduling
- [ ] Support configurable billable service types with their own pricing and duration rules

## Non-Goals

- Public marketplace features
- General music-school CMS features unrelated to scheduling, billing, staff, and student management
- Premature support for many unrelated business types

## Constraints

- Frontend and backend should be built with Next.js
- Deployment target is Vercel
- Initial auth must include Google login
- Supabase Postgres is the operational database and Supabase Auth handles identity
- All tenant-owned records must be school-scoped and protected by Row Level Security
- Hosted payment pages must handle card data; this app must not collect card details

## Notes

- Primary roles currently identified:
- School owner
- Teacher
- Student
- Parent, guardian, or account administrator
- Additional requirements identified:
- Use Stripe-hosted onboarding, invoices, Checkout, and customer portal rather than collecting payment details inside the app
- Let students and guardians schedule or reschedule lessons
- Consider SMS messaging for reminders and operational communication
- Support more than one billable category, including rehearsal, group class, and space rental
- The visual direction should feel closer to a modern trading dashboard than a generic school admin app.
