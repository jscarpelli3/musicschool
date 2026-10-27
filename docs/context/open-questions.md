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

## Platform plans and solo schools

- Should **solo school** be purely a reversible workspace preference, a commercial tier, or both? Product behavior must remain reversible even if pricing eventually uses it.
- Which conveniences should solo mode enable automatically, and which should remain user preferences? Initial candidates are owner-teacher defaults, fewer teacher selectors, simplified setup, and quieter multi-teacher coordination UI.
- What happens when a solo school adds a second active teacher: automatically leave solo mode, warn and ask, or retain the preference while disabling assumptions that are no longer safe?
- What should determine subscription price: active teacher count, selected plan, active students, payment volume, or feature access? Provisional discussion points are roughly `$8/month` for solo and `$20/month` for up to five teachers; neither price nor boundary is decided.
- How should beta promises be represented: fixed trial end, a number of free months beginning at activation, an explicit `comped_through` date, or a combination with an auditable admin note?
- Which super-admin actions are appropriate for v1, and which require stronger controls or must never exist? School lookup, plan/trial management, account status, and support diagnostics are expected; silent tenant impersonation and direct financial-history editing should not be normal controls.
