# Current Status

## Phase

Foundation scaffolded and Supabase linked; authentication and domain design next

## Active Focus

Configure Google OAuth, then design the v1 multi-tenant music-school schema and authentication flow.

## Next Steps

1. Enable and configure Google OAuth in Google Cloud and Supabase Auth
2. Define the v1 schema, relationships, indexes, and Row Level Security policies
3. Define roles and permissions for owners, administrators, teachers, staff, guardians, and students
4. Define availability, recurrence, cancellation, rescheduling, and timezone rules
5. Implement Google login, school creation, selected-school context, and invitations
6. Build the private-lesson scheduling vertical slice
7. Add Square customer/invoice associations, then Stripe SaaS subscriptions
8. Add transactional email; defer SMS until its consent and compliance workflow is designed

## Risks

- A complete selected-school context must replace the reference app's first-membership behavior
- RLS policies must be tested to prevent cross-school access
- Guardian/student access increases authorization complexity
- Billing and scheduling rules are not yet specified
- Service pricing and duration rules are not yet specified
- Calendar, cancellation, and reminder rules are not yet specified

## Updated

2026-08-04
