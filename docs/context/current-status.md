# Current Status

## Phase

Tenant foundation deployed; Google OAuth configuration next

## Active Focus

Enable Google OAuth, exercise the owner onboarding flow, then design the people and customer-account domain.

## Next Steps

1. Enable and configure Google OAuth in Google Cloud and Supabase Auth
2. Test Google login, profile creation, atomic school creation, owner membership, and protected dashboard access
3. Add people, customer accounts, students, guardians, teachers, and their RLS policies
4. Add the school macro calendar and teacher availability
5. Add staff and portal invitations
6. Build the private-lesson scheduling vertical slice
7. Add Stripe Connect family billing, then Stripe Billing software subscriptions

## UI And Media Foundation

- Semantic Tailwind design tokens are configured for colors, radii, spacing, typography, and shadows.
- Profile avatar and school logo upload flows are deployed with private Storage policies.
- The first school has a demo roster: the owner as a teacher, two additional teachers, 12 students, eight guardian payers, two self-paying students, and ten billing accounts.
- School owners and administrators can define and archive private-lesson and group-class products with explicit duration, cadence, price, pricing model, and capacity.
- The owner dashboard has day, week, and month planner views with teacher filtering, recurring availability windows, occupied lesson blocks, and monthly capacity indicators.
- The demo school has ten weekly availability blocks and 84 lesson occurrences covering 12 students across seven weeks; one teacher demonstrates split Wednesday hours.
- Lesson occurrences reference a flexible school-owned Places list; owners/admins manage it and teachers may add their own entries.
8. Add transactional email; defer SMS until its consent and compliance workflow is designed

## Risks

- A complete selected-school context must replace the reference app's first-membership behavior
- RLS policies must be tested to prevent cross-school access
- Guardian/student access increases authorization complexity
- Billing and scheduling rules are not yet specified
- Service pricing and duration rules are not yet specified
- Calendar, cancellation, and reminder rules are not yet specified

## Completed Foundation

- Next.js application and Supabase SSR clients
- Linked Supabase project and generated database types
- Profiles synchronized from Supabase Auth
- Schools and active school memberships
- Owner/admin/teacher/staff role vocabulary
- Atomic `create_school` database function
- Row-scoped membership and role helpers
- RLS on profiles, schools, memberships, and audit records
- Immutable-column grant restrictions
- Google login UI, OAuth callback, sign-out, onboarding, school chooser, and protected dashboard routes

## Updated

2026-08-05
