# Rescheduling Audit Log

This append-only log tracks the scheduling-side implementation while payment Step 8 is paused.

## Owner single-lesson rescheduling

Status: In progress
Activated: 2026-08-08

### Pre-step direction review

- One lesson keeps one identity. Rescheduling updates its operational plan and appends immutable before/after history rather than creating an unrelated replacement event.
- The occurrence price and original billing-service date remain immutable. Moving across months must not remove or duplicate its financial obligation.
- Calendar drag-and-drop proposes a destination; it never persists on drop. A separate hold-to-confirm action performs the database transaction.
- Owners/admins may change teacher, time, and place. Availability overrides require an explicit reason; teacher and student collisions are never overridable.
- Completed, cancelled, no-show, rescheduled-legacy, and past lessons do not enter this workflow.
- Tablet drag activates only after choosing Reschedule so scrolling remains predictable. Phone uses a focused date/time form backed by the same validation.
- The macro school calendar and dated teacher exceptions are designed but not yet implemented in the database. The first owner flow can enforce existing recurring availability and conflicts; closure/exception enforcement must be added before parent self-service launches.

### Data foundation checkpoint

- Added an immutable billing-service date to every occurrence price snapshot and backfilled it from the school-local original lesson date.
- Added immutable lesson-event change history with actor, role, source, reason, policy version/result, before/after values, and self-service-count evidence.
- Added one owner/admin reschedule transaction with row locking, future/status validation, duration preservation, recurring-availability validation, hard teacher/student conflict checks, optional recorded availability override, history, and audit logging.
- Deployment and transactional scenario verification remain required.
- Updated monthly draft selection to use the immutable billing-service date while retaining the current operational start in explanatory metadata.
- Added a rollback-only cross-month rehearsal covering same lesson identity, duration/status preservation, immutable history, unchanged price/billing anchor, original-month inclusion, and destination-month non-duplication.
- The cross-month rehearsal passed and rolled back without residue.
- Added a second rollback-only matrix for non-overridable teacher conflict, failed-attempt history rollback, outside-availability rejection, and explicitly recorded owner override.

### Owner interaction checkpoint

- The conflict/override rehearsal passed and rolled back without business-data residue.
- The existing lesson detail sheet now starts explicit reschedule mode for eligible future scheduled lessons.
- The selected lesson becomes a pointer-driven drag source for mouse, pen, and touch. Five-minute snapping, duration preservation, edge scrolling, teacher-rail transfer, client-side availability/conflict feedback, a persistent original position, and a valid/invalid destination ghost are implemented.
- Dropping creates only an in-memory proposal. The shared confirmation panel compares old/new time, teacher, place, and immutable billing month; only its hold action calls the verified database transaction.
- A shared focused picker covers phone, keyboard, and non-drag use. It is open by default and exposes date, time, teacher, place, reason, and the explicit owner availability override.
- Reschedule controls and confirmation were extracted from the planner into a reusable scheduling component for later teacher and client flows.
- ESLint, TypeScript, and the production build pass. An authenticated visual/pointer walkthrough remains required before the owner interaction exit gate passes.
