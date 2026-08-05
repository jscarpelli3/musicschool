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
- Billing planning now explicitly supports owner-initiated charges against authorized saved payment methods alongside automatic charges, invoices, and manual collection.
- Billing approvals are planned as channel-independent, expiring records; single-use approval links come first, with unique-code SMS replies as a compatible later channel.
- Responsive phone/tablet/desktop behavior is now a required design and code rule; the planner's dedicated touch/narrow-screen adaptation remains pending.
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
# Current implementation note — billing approval links

- Added the database foundation for hashed, expiring, idempotent billing approval links and immutable approval events.
- Added a responsive public cost-breakdown route at `/approve/[token]` and a reusable pointer/keyboard hold-to-confirm component.
- Approval is deliberately separate from collection. Stripe Connect charging, Stripe receipt delivery, and SMS sending remain unconnected until provider accounts and credentials are configured.
- The approval-link migration is deployed to the linked Supabase project and the public read RPC has been verified against the seeded preview request.

# Current implementation note — School Setup

- The dashboard now has one School Setup entry and no owner-facing school switcher.
- Shared responsive setup navigation covers School Info, Lessons & Classes, Lesson Spaces, Policies & Documents, and Staff.
- School Info owns logo, phone, and address; Staff presents the current teacher roster; the existing offering and place tools now live in the shared setup shell.
- Added local migrations for versioned hybrid policies, structured cancellation/payment rules, private document metadata, offering policy selection, lesson series, occurrence exceptions, and actual delivery facts.
- The School Setup and lesson-series migrations are deployed to the linked Supabase project. Local and remote migration histories match through `20260805102000`.
- Removed school-logo and avatar upload forms from the owner dashboard. School logos now live only in School Info; personal avatar/contact editing lives at the global `/profile` settings route linked from the dashboard header.
- Added a dashboard student roster with a persistent reorderable column layout, family/student/payer context, recurring lesson synopsis, and an occurrence-by-occurrence monthly outcome line. Its mobile layout remains a horizontally scrollable semantic table with touch-accessible column-order controls.
- Changed owner-facing offering prices to per-lesson amounts with a non-binding four-week schedule estimate. Actual month totals follow the calendar's three, four, or five occurrences.
- The demo roster has a complete current-month schedule plus deliberately varied serviced/rescheduled/timely-cancelled/late-cancelled/no-show states and varied payer relationships for display work.
- Column arrangement is visually attached to the table headers: direct header drag-and-drop with insertion lines on pointer devices, plus in-header arrow controls for touch and keyboard use.
- Student roster headers also carry independent sort controls. Student and payer columns cycle name/relationship modes; recurring day, local lesson time, teacher, and space are separate structured columns; monthly sorting cycles serviced, no-show, reschedule, cancellation, and total-occurrence counts.
- Wide data tables keep readable column widths. The reusable horizontal scroll frame supports direct touch swiping, a permanently visible synchronized rail above long tables, paging arrows, native bottom scrolling, and line-based edge cues.
- Student roster column order and active sort mode now load from and save to a per-user, per-school database preference rather than browser-local storage. Client saves are serialized to preserve interaction order.
# Payment implementation tracking

- `payment-roadmap.md` is the canonical flexible plan.
- Step 1 passed its exit gate and was pushed in commit `c5fff81`.
- Step 2, Payment data foundation, is active after confirming the ledger should precede provider configuration and user-facing payment controls.
- Every step has a pre-implementation direction/risk review and a post-implementation persistence/security/test/operations gate.
