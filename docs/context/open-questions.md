# Open Questions

Capture unresolved questions here so they do not get lost between sessions.

## Product

- What are the first teacher-facing workflows?
- Can students schedule with any teacher, or only assigned teachers?
- Which workflow follows private lessons: rehearsal, group class, or space rental?
- Should pricing always be derived from duration, or can a service type override with flat pricing?
- Are monthly service periods always calendar months, or can a school select another billing day?
- How many self-service reschedules are allowed per student and monthly period?
- Can a make-up lesson cross into a later monthly period, and when does that entitlement expire?
- What billing result applies to timely cancellation, late cancellation, no-show, teacher cancellation, and school closure?

## Technical

- Which Stripe Connect account configuration best preserves school merchant-of-record status, Stripe-collected fees, and Stripe-managed payment risk at launch?
- How should configurable pricing work: per service type, per teacher, per room, or per customer?

## Resolved Direction

- SMS is transactional and two-way only where interaction is useful. Approval begins with a secure URL; Twilio handles reserved STOP/START/HELP replies, and inbound consent state is synchronized into the application. Free-form conversational texting is out of scope.
- Email is the included delivery channel. SMS is a paid add-on operated by Common Time: schools do not need their own Twilio login, but each add-on school receives an isolated Twilio subaccount, dedicated number, end-business verification, and non-transferable school-specific consent program.

## Deferred

- Is a CMS needed for public marketing or policy content after v1?
- Do users need to switch between multiple schools in the initial release, or may v1 enforce one active school membership per user?
