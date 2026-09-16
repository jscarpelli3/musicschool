# Client Portal Access

## Decision

Family access should feel passwordless, but lesson schedules are not public data. Minor names, recurring times, teacher relationships, contact details, and in-home locations require authenticated, relationship-scoped access.

Use Supabase one-time email codes for the family portal:

1. A school records the payer's email on a billing account and creates a matching portal authorization.
2. Supabase sends a short-lived, single-use numeric code to that exact address without revealing whether the address exists.
3. After verification, database functions resolve only the billing accounts explicitly authorized to that normalized email.
4. The browser keeps a renewable session, so subsequent visits normally open the portal directly without another code or password.
5. A client can request another code at any time; no password creation or recovery flow is required.

Payment approval links remain separate. They are expiring, single-purpose URLs bound to one immutable billing-period snapshot. They may display that amount and accept or decline it without granting access to the broader portal.

## Access boundaries

- Guardians see only students connected to their own school person record through `student_contacts`.
- Adult students may access their own record when their `people.profile_id` is linked.
- Billing contacts see only billing accounts where they are the recorded contact and the students attached to those accounts.
- Payers see only sent-or-later statements for authorized billing accounts. Safe line items are visible; drafts, internal metadata, and other families remain hidden.
- Staff-only notes, internal policy decisions, teacher-wide availability, other family contacts, raw provider payloads, and payment-operation controls are never included in client queries.
- Detailed in-home addresses should be shown only when needed for that client's own lesson and should not appear in email previews or generic approval pages.
- Removing a contact relationship or deactivating a person must revoke portal authorization at the database-policy layer, not only hide navigation.

## Implemented foundation

The portal now includes relationship-scoped lessons, private rotatable calendar subscriptions, automatic-payment permission and revocation, and itemized sent statement history. Ambiguous email mappings stop with a support message rather than selecting a family. Draft statements, internal notes, provider payloads, and payment controls remain unavailable.
