# Client Portal Access

## Decision

Family access should feel passwordless, but lesson schedules are not public data. Minor names, recurring times, teacher relationships, contact details, and in-home locations require authenticated, relationship-scoped access.

Use Supabase email magic-link authentication for the family portal:

1. A school links a specific person record to a portal invitation.
2. Supabase sends a short-lived, single-use authentication link to that verified email address.
3. The callback links the authenticated profile to the intended school person only after invitation and email checks pass.
4. The browser keeps a renewable session, so subsequent visits normally open the portal directly without another email or password.
5. A client can request another link at any time; no password creation or recovery flow is required.

Payment approval links remain separate. They are expiring, single-purpose URLs bound to one immutable billing-period snapshot. They may display that amount and accept or decline it without granting access to the broader portal.

## Access boundaries

- Guardians see only students connected to their own school person record through `student_contacts`.
- Adult students may access their own record when their `people.profile_id` is linked.
- Billing contacts see only billing accounts where they are the recorded contact and the students attached to those accounts.
- Staff-only notes, internal policy decisions, teacher-wide availability, other family contacts, raw provider payloads, and payment-operation controls are never included in client queries.
- Detailed in-home addresses should be shown only when needed for that client's own lesson and should not appear in email previews or generic approval pages.
- Removing a contact relationship or deactivating a person must revoke portal authorization at the database-policy layer, not only hide navigation.

## Planned implementation sequence

1. Build staff-facing student and family detail pages against current durable records.
2. Add invitation records with expiration, single-use consumption, intended person, intended email, inviter, and audit history.
3. Link authenticated profiles to school person records only through the verified invitation callback.
4. Add relationship-based RLS policies and automated cross-family denial tests.
5. Build a reduced client portal from reusable presentation components, with no staff-only fields.
6. Add email delivery and session/revocation operations before inviting real families.
