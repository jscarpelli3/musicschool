# Inline form audit — August 25, 2026

## Standard

A form stays inline when it is the page's primary job, a small contextual action, or depends on information immediately surrounding it. A substantial create/edit form embedded in a roster, list, dashboard, calendar, or detail record opens in the shared `FocusedModal` instead. Modals support backdrop close, Escape, scroll locking, focus return, a visible close control, pending/error feedback, and a success toast when the modal closes automatically.

## Moved to focused modals

- Staff: add teacher, access/invitation, scheduling permissions, and weekly availability.
- Spaces: create a place from the current-place list.
- Offerings: create a lesson/class from the current-offering list.
- Family billing: edit payer email, edit payer mobile number, and add a billing adjustment.

These workflows were previously exposed as full inline forms or expanding `details` elements inside a broader management surface.

## Correctly inline

- Authentication: family portal email/code steps, SMS consent, and sign out. The form is the page task.
- Initial setup and profile: create school, school information, logo, theme, instrument catalog, and user profile. These are dedicated settings pages and benefit from visible values.
- Scheduling: the new-lesson form already lives in the calendar's focused modal; lesson outcome and reschedule controls live inside the selected lesson detail context.
- Billing review: prepare, lock, revise, approval delivery, card setup, and unlock controls depend on the statement immediately around them.
- Public payer approval: approve/reject controls depend on the proposal being reviewed and should remain visible in that context.
- Integrations: Stripe connect/sync controls are small one-action forms.
- Row actions: archive, remove, retry, disable, mark-read, delete, and sign-out forms are action buttons rather than data-entry forms.
- Filters, search, toggles, and compact selectors stay inline because opening a modal would interrupt direct manipulation.

## Follow-up checks

- Use `FocusedModal` for new substantial embedded forms by default; do not copy its dialog mechanics into feature components.
- A successful modal action should close the modal and raise the shared toast when no follow-up work remains. A failed action should keep the modal open with the error next to the fields.
- Destructive actions still require the established hold-to-confirm or explicit confirmation pattern; merely placing them in a modal is not confirmation.
- Re-run this inventory when a new dashboard, list, roster, or detail workflow is introduced.
