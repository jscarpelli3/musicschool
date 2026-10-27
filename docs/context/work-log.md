# Work Log

Use this file for short chronological notes about meaningful work.

## 2026-08-31 — orthogonal cancellation outcomes

- Implemented the first compatibility phase of the cancellation redesign locally. Published legacy rules now derive seven uniform scenario/timing recipes whose calendar action, service truth, original charge treatment, replacement service, and fee/credit action are independent. Existing policies and decisions remain intact.
- Added an append-only decision-revision record, a current-revision pointer/view, immutable policy-outcome rows, RLS/select boundaries, revoked direct mutations, backfill adapters, automatic adapters for the existing owner resolver, and migration assertions. The existing owner UI continues to use the legacy transaction while producing the new evidence automatically.
- Deployed migrations `20260831120000` and `20260831121000`; all embedded backfill, pointer, RLS, and grant assertions passed, and local/remote migration histories match. Regenerated the checked-in TypeScript database contract from the live schema. Linked lint reports no new issue; its two warnings are pre-existing unused variables in unrelated notification/request functions.

## 2026-09-01 — family cancellation rules matrix foundation

- Deployed school-level timely-approval and refund-presentation settings plus append-only, effective-dated payer overrides with private reasons, owner/admin-only RLS, direct-write revocation, audited mutation RPCs, and a portal preview adapter that resolves school defaults and active payer overrides server-side.
- Replaced the portal’s misleading preparatory cancellation button with immediate policy evaluation and clear reschedule/account-credit choices. The one consequential action now occurs in a focused hold-to-confirm dialog with Escape handling, focus containment, and explicit scheduled-until-reviewed language.
- At the initial access-settings checkpoint, automatic cancellation and portal refund requests remained disabled in both UI and server action pending their complete business transactions. TypeScript, ESLint, diff checks, and the production build passed.
- Deployed the first safe automatic path in `20260902120000`: a timely family reschedule may atomically cancel the occurrence, preserve not-serviced truth, waive the original occurrence for accounting, create equivalent unscheduled service, record the payer Auth user as initiator and `system_policy` as decision source, and queue owner/teacher/family notifications. Account-credit cancellations and refunds remain owner-reviewed. The setting is now available in the policy UI.

## 2026-08-24 — teacher availability and autonomy

- Added owner and teacher weekly availability editors backed by effective-dated multi-block rules; per-teacher scheduling authority and separate self-availability permission; atomic replacement with rollback-safe errors; and append-only domain-event plus audit evidence. Existing lessons are never moved by an availability edit. Durable lesson proposals and outside-block acceptance remain the next active slice.

## 2026-08-19 — security audit program and payer portal hardening

- Established `docs/audits/security-audit-log.md` as the living, append-only master security due-diligence record. It defines scope, procedure, evidence requirements, severity/retest rules, process-change history, recurring TODOs, and the first detailed audit run.
- Logged the payer-portal boundary findings and local remediation: payer-account-only authorization, private per-school email bindings, cross-school reuse, same-school duplicate denial, owner/admin-only silent Auth provisioning, no portal self-signup, explicit access states, local-only logout, and database regression assertions.
- Recorded the remaining deployment and live-test gate accurately. TypeScript, focused lint, and production build pass; Supabase migrations and live adversarial checks remain blocked until CLI authentication is restored.
- Expanded the master audit process with dedicated Stripe and Resend API regression suites and baseline/automation TODOs. The suites cover configuration, authorization and tenant/object binding, signatures, replay/concurrency/order, idempotency, ambiguous provider failures, retries/suppression, safe logs, and provider-state reconciliation.
- Deployed payer-portal migrations `20260819113000` and `20260819114000`; the database boundary assertions passed and linked lint has no new finding. Cleaned the reachable test email down to one Davis family binding, preserved historical evidence, confirmed its silent Auth identity, and verified the live access state is `ready` with exactly one active authorization.
- Published matching application commit `59c5f45`; Vercel completed the production deployment and the live `/portal` smoke check passed with private/no-store caching, HSTS, and search-engine exclusion. The Davis live OTP/lesson test and the remaining adversarial portal matrix are next.
- Davis live portal acceptance passed: the provisioned payer received the normal code template, entered the OTP, and saw the authorized lessons. Logged this as the `valid-populated` partial pass without closing the remaining security matrix.
- Replaced the portal's bespoke lesson cards with reusable `CalendarRange` and `LessonCalendar` components. Calendar months, day placement, school grouping, and timezone conversion are data-driven; phone renders an agenda and tablet/desktop render the month grid from the same component and Tailwind token system.
- Built a private, revocable family lesson-calendar subscription locally. The feed is scoped to one active payer billing account, stores only a token digest, uses stable lesson event IDs, publishes cancellations/reschedules as calendar cancellations, and avoids duplicate-prone repeated imports. Added portal create/replace/revoke controls and provider-specific URL instructions. TypeScript, focused lint, and the production build pass; database migrations and publication remain blocked until Supabase CLI authentication is restored.
- Made every family-calendar lesson a touch-, pointer-, and keyboard-accessible control. Selecting one opens a responsive lesson-detail sheet with date, time, offering, teacher, and place; Escape, backdrop/close controls, focus trapping, and focus return are included. Consequential cancellation/reschedule actions remain gated on their atomic server mutation rather than presenting nonfunctional controls.
- Deployed the private-calendar migrations and their database boundary assertions, then published the matching subscription and clickable-lesson application commits. Linked lint had no new issue, Vercel completed successfully, and live portal/malformed-token HTTP smoke checks passed. Authenticated click and real calendar-provider acceptance remain owner-driven checks.
- Added a formal late-development platform-admin/test-console TODO: isolated deterministic fixtures, full role-side interaction simulation, provider/webhook success and failure controls, named expected-result vectors, evidence inspection/reset, and strict audited production-impersonation safeguards.
- Completed the family-facing lesson request path through request-only submission: payer-bounded policy preview, clear timely/late and cutoff language, authoritative submission timestamp, immutable policy/accounting snapshots, duplicate prevention, timestamped portal receipt, server-only Resend delivery, and owner/admin/assigned-teacher notification fan-out. The lesson and all billing/payment/credit state remain unchanged pending the future owner queue.
- Live late-cancellation request acceptance passed for the Davis portal family. The request timestamp and outside-window/serviced result were correct, the lesson remained scheduled, and requester plus owner email reached Resend. The teacher message failed only because its seeded address uses reserved `example.com`; staff delivery truth remains recorded, while provider failures were removed from the family-facing receipt because they require no payer action.
- Moved the school identity, profile/sign-out, creation/setup actions, and right-aligned notification control into a shared school-route layout. Student, payer/family, payment, setup, and lesson pages now render beneath the same persistent owner header instead of losing owner navigation outside the dashboard.
- Added the full owner Notifications center with active and archived history, row/select-all selection, bulk mark read/unread, restore, and hold-to-archive confirmation. Archive removes clutter without deleting related business or audit evidence. The header dropdown is limited to the 20 most recent active notifications from the last seven days and links to the full list.

## 2026-08-11

- Recorded Twilio's rejection of the initial generic toll-free verification: the submission did not identify one end business, exposed a login-protected website to review, and allowed consent to appear reusable across schools/programs.
- Reversed the Step 8 channel priority. Transactional email through Resend is now included and blocks charge execution; Twilio no longer blocks the core payment flow.
- Reframed SMS as a separately priced school add-on. Common Time operates the parent ISV account, while each add-on school receives an isolated subaccount, dedicated number, verification, fixed public consent program, and school-scoped opt-out state.
- Preserved the existing Twilio work as implementation foundation, not production authorization. The current rejected number may be reassigned exclusively to the first school for a corrected verification and real-handset test; it cannot serve multiple schools.

## 2026-08-12

- Recorded ownership of `commontime.studio` and the accepted hostname plan: `www` for marketing/public policies, `app` for application routes and provider callbacks, and `notifications` for Resend authentication.
- Updated the production cutover runbook with the concrete hostnames and preserved the apex/temporary Vercel aliases as rollback paths until provider acceptance tests pass.

## 2026-08-13

- Added hostname-aware deployment behavior: the apex permanently redirects to `www`, `www` renders a lightweight indexable Common Time Coming Soon page, and application/legacy hostnames emit an HTTP-level noindex/noarchive directive.
- Added a one-page public sitemap and robots response for `www`; unknown public paths return to the Coming Soon root rather than exposing application routes on the marketing hostname.
- Completed the custom application-origin checkpoint: Supabase/Google login, production `APP_URL`, all Stripe test webhook destinations, and the legacy Twilio callbacks now use `app.commontime.studio` and passed provider/durable-intake checks.
- Confirmed the legacy Twilio Messaging Service validity period is 3,600 seconds and verified signed inbound/fallback health checks without recording a consent event.
- Deployed the Resend email-delivery foundation: durable pre-provider attempts, append-only replay-safe events, global permanent-bounce/complaint suppression, provider-response reconciliation, and service-role-only mutation functions.
- Added editable payer email, email-first approval controls, responsive HTML/plain-text approval mail, direct send-only Resend API integration with stable idempotency keys, and a raw-body Svix-verified webhook endpoint.
- Regenerated linked database types and passed TypeScript, ESLint, and linked Supabase database lint. Resend webhook registration, its Vercel signing secret, deployment, and end-to-end provider rehearsals remain the active Step 8 gate.

## 2026-08-14

- Completed the first real Resend approval sequence for a locked four-lesson, $220 family period. Provider acceptance, signed sent/delivered callbacks, immutable approval evidence, and absence of a Stripe charge were verified directly in Supabase.
- The exit audit exposed and fixed a legacy split-state defect: payer approval advanced the request but not its parent period. Approval now advances both atomically, and the accepted test period was reconciled to approved without creating a payment attempt.
- Added the first owner-adjustment slice: real charge/credit ledger lines with required category/explanation, automatic total recalculation, audit-backed removal, draft-refresh preservation, and locked-period denial. The database migration, types, lint, and app checks pass; deployment rehearsal is next.
- Added separate payer auto-charge mandates without broadening the earlier saved-card consent. Approved payers may opt into itemized automatic monthly collection with a notice window and optional cap; email is now the sole standard approval channel and SMS is hidden unless a future school add-on exists.
- Added immediate mandate revocation with append-only evidence. The short approval page can now enroll or stop automatic payment; long-lived frictionless payer access remains a prerequisite before production collection.
- The first live adjustment rehearsal intentionally locked its edited period and exposed a workflow hole. Added an audited unlock-to-review control for unsent locked amounts; submitted links remain protected for the forthcoming revise-and-replace flow.
- Added structured payer rejection with optional explanatory notes. Rejected bearer proposals become unusable and return their unchanged period to owner review; the owner sees the exact feedback and remains responsible for any factual or financial correction.
- Confirmed that students do not belong exclusively to one teacher. Logged occurrence-level substitute assignment and free-floating standalone makeup/ad-hoc lessons as scheduling invariants, including immutable teacher-change history and actual-teacher workload attribution.
- Garcia's corrected $200 test proposal was submitted to its seeded fake payer address and failed safely at Resend. Added atomic revise-and-replace recovery so the pending token is cancelled before the unchanged period returns to owner review; failed delivery evidence is preserved.

## 2026-08-09

- Completed the Stripe Connect test foundation through hosted school onboarding, human-readable account synchronization, signed/idempotent webhook intake, payer card setup, saved-method reconciliation, and detach handling.
- Completed monthly billing draft generation and locking with immutable price/policy attribution, visible blockers, refresh idempotency, manual adjustments, three/four/five-occurrence coverage, and fixed-monthly tuition coverage.
- Added public transactional-SMS enrollment with canonical append-only evidence, durable approval-link delivery records, signed delivery callbacks, and owner/admin sending from locked family periods.
- Added signed Twilio inbound and fallback routes. Advanced Opt-Out owns customer replies while STOP/START/UNSTOP/HELP events synchronize application consent state without retaining unrelated message content.
- Configured the temporary-domain Twilio incoming, fallback, and delivery callback URLs and saved custom Advanced Opt-Out messaging. Toll-free verification remains in review.
- Added a production-domain cutover runbook covering Vercel, Twilio, Stripe test/live destinations and secrets, Supabase, Google OAuth, DNS, public copy, monitoring, acceptance tests, and rollback order.
- Audited touch-only phone/tablet planner behavior. Phone now initializes one-teacher day view, month cells become day-opening summaries, touch rails toggle explicitly, and lesson drag begins only from its reschedule handle so ordinary scrolling/tapping remains safe.
- Made phone lesson/confirmation sheets viewport-sized with reachable sticky headers and added coarse-pointer target sizing without making hover a required interaction.

## 2026-08-05

- Deployed teacher availability rules and scheduled lesson occurrences, then populated seven weeks of demo lessons for all 12 students.
- Replaced the school foundation placeholder with an owner planner offering day, week, and month views, teacher filters, open-time fields, booked lessons, and occupancy lines.
- Added expanding availability fields and steeply angled teacher labels to distinguish overlapping teacher windows without obscuring booked lessons.
- Made planner expansion teacher-scoped: the active teacher's availability and lessons expand together while other teachers' lessons retain their width beneath the active layer; doubled the angled teacher-label size.
- Made lesson occurrences clickable in every planner view and added an in-context detail sheet for lesson, teacher, student, guardian, and billing-payer information.
- Pinned angled teacher labels entirely above availability fields and added one-second delayed lesson quick views for student name and time.
- Raised hovered lessons above every planner layer, extracted delayed quick views into a reusable UI primitive, and formalized component/modularity requirements in `code-rules.md`.
- Simplified lesson blocks to responsive student names, moved time and place into delayed quick views, and deployed structured school-room, student-home, and custom lesson locations.
- Changed inactive teacher availability to compress into persistent hoverable rails with fading labels, allowing expansion to transfer fluidly across a calendar column.
- Moved compressed teacher rails to their corresponding outer edges and sized the active availability and lesson fields to the space remaining between them.
- Scoped teacher compression to the active day only, reduced inactive rails to exactly four pixels, and made lesson occurrences collapse and expand with their teacher's availability field.
- Replaced hard-coded lesson location categories with a reusable school-owned Places list, migrated existing occurrences, and added owner/admin/teacher place management.
- Added lesson duration to the delayed calendar quick view alongside the time range and place.
- Enforced non-overlapping teacher availability while preserving multiple same-day blocks, and added split Wednesday hours to the demo owner schedule.
- Recorded flexible billing collection and approval modes, including owner-triggered off-session charges using authorized saved payment methods.
- Added mandatory phone, tablet, and desktop design/code rules and documented the planner adaptations still required for touch and narrow screens.
- Designed channel-independent monthly charge approvals with a single-use web link first and auditable unique-code SMS replies as a later two-way channel.

## 2026-08-04

- Added a semantic Tailwind configuration for centralized colors, radii, spacing, typography, and shadows.
- Added private profile-avatar and school-logo storage design, upload actions, signed image display, and tenant-aware Storage RLS policies.
- Defined an anti-template design brief and added a temporary `/design` typography study comparing Newsreader, Bricolage Grotesque, and IBM Plex Sans.
- Reworked the typography study into dark charcoal, aged-oak, and blackened-bronze material variations to match the selected visual atmosphere.
- Added a live interaction study and reusable line-based grammar for hover, focus, selectors, connected data, progress, and accessible hold-to-confirm actions.
- Replaced the typography study's one-off colors with the same semantic dark material tokens used by the production interface.
- Deployed private media storage plus the school-scoped people, teacher, student, family-contact, and billing-account foundation.
- Seeded the first school with three teachers including the owner, 12 students, eight guardian payers, two self-paying students, two multi-student families, and ten billing accounts.
- Deployed the school service-product catalog and added an owner/admin setup screen for private lessons and group classes with duration, cadence, pricing, and capacity controls.

- Reviewed the local Agency Brain repository as a read-only architecture reference.
- Adopted Next.js, Vercel, Supabase Auth/Postgres/RLS, Google OAuth, and a shared multi-tenant database as the platform direction.
- Initially separated Stripe SaaS subscription billing from Square-hosted family payments; this was later superseded by Stripe-only billing.
- Defined the first shippable milestone as a private-lesson scheduling and billing-link vertical slice.
- Added an account and provider setup checklist.
- Scaffolded a lean Next.js 16 App Router application with TypeScript, Tailwind CSS, and ESLint.
- Installed only the Supabase JavaScript and SSR runtime packages beyond the framework dependencies.
- Added current browser/server Supabase clients and a Next.js session-refresh proxy.
- Initialized the local Supabase CLI directory and verified the project URL and publishable key against the Auth API.
- Confirmed Google authentication is not yet enabled in the Supabase project.
- Authenticated the Supabase CLI and linked the local repository to the `MusicSchool` project in the West US region.
- Defined recurring teacher availability, dated exceptions, lesson enrollments, monthly service periods, materialized lesson occurrences, and immutable event-change history as the scheduling foundation.
- Established school-specific, effective-dated cancellation and rescheduling policies and monthly aggregation of family billing items into processor invoices.
- Accepted both fixed monthly tuition and monthly usage billing, with a school default and optional service-agreement override.
- Added a school macro calendar for terms, closures, holidays, performances, camps, registration windows, and other school-level events with explicit scheduling effects.
- Deployed the identity and tenancy foundation to Supabase: profiles, schools, memberships, audit records, helper functions, RLS policies, and atomic owner onboarding.
- Added column-level privilege restrictions and confirmed the deployed schema passes Supabase database linting.
- Generated database types and implemented Google login, OAuth callback, sign-out, school setup, multi-school selection, and a protected school dashboard.
- Verified TypeScript, ESLint, the production build, unauthenticated route redirects, and anonymous denial of the school-creation RPC.
- Standardized payments on Stripe Billing and Stripe Connect, with direct school payments and a lightweight Square-to-Stripe cutoff plan for the first school.

## 2026-03-10

- Created initial repository context files.
- Established a lightweight documentation structure for planning and ongoing execution.
- Captured the first high-level product brief for a private lesson music business platform.
- Recorded initial architecture direction and open questions around tenancy, CMS fit, and database choice.
- Added payment-processing direction with Square and noted self-service scheduling requirements for students and guardians.
- Added SMS as a supported future communication channel and recorded related architecture questions.
- Clarified that Square should own all checkout and invoice management experiences, with this app only maintaining minimal external associations.
- Expanded the domain model to include configurable billable service types such as lessons, rehearsals, group classes, and space rentals.
- Built the first billing-consent vertical slice: hashed single-use approval URLs, exact monthly line items, separate approval/payment state, audit events, and a responsive hold-to-approve page. Live SMS, Stripe charging, and Stripe receipts remain provider-integration work.
- Reorganized owner configuration into a shared five-tab School Setup shell, moved owner-facing language from products to lessons/classes/offerings, added School Info and Staff views, and modeled versioned policies plus planned-versus-actual lesson occurrences.
## 2026-10-11 — Payment restart checkpoint

- Reconciled the repository handoff after the approved-statement work in PRs #69–#73.
- Recorded the successful synthetic $2.00 Stripe charge, the initially missing PaymentIntent webhook subscription, the app's fail-closed pending state, the subscription correction, and the manual authoritative reconciliation.
- Recorded that automatic webhook settlement is not yet accepted and is the single next human payment test.
- Established the rule that every implemented, deployed, provider-configured, and human-tested payment step must update `session-handoff.md` and append the payment audit log before being called complete.

## 2026-10-12 — Contextual lesson entry and directory navigation

- Added lesson-entry actions directly to student and family calendars while retaining the global New Lesson action.
- Scoped contextual lesson entry safely: student records preselect their student, and family records show only students linked to that school-scoped family.
- Added searchable, scrollable Students and Families navigation directories without changing the main-label links to the full directories.
- Added simple search to the full student and family pages.
- Recorded that this is a workflow/navigation step only; the next payment acceptance remains a new approved `TestFamily` statement settling automatically through the signed Stripe PaymentIntent webhook.
- Validation passed: TypeScript, ESLint, production build, and all 60 local Node tests.
- Follow-up: made in-place lesson creation a calendar-wide owner interaction rule. Student and family calendars now open the creation sheet over the visible calendar with context-scoped students, matching the existing overall/teacher calendar workflow.
- Follow-up: removed the navigation dropdown hover gap and made the dropdowns smaller and more visually distinct.
- Follow-up validation passed: TypeScript, ESLint, production build, and all 60 local Node tests.
- Fixed the inert record-calendar Add lesson regression by moving the creation overlay presentation into a dialog-owned CSS module that loads on every host page.
- Added the searchable, scrollable quick directory to Staff while preserving the Staff label as the full-directory link.
- Regression validation passed: TypeScript, ESLint, production build, and all 60 local Node tests.
- Created two normal-RPC synthetic October lessons for the staging test family at non-overlapping times inside the teacher’s saved availability; verified both immutable $1.00 price snapshots and recorded their IDs in the handoff/payment audit.
- Added the first reusable lesson-opening finder above owner, student, and family calendars. It uses service duration, teacher availability, date/day/time preferences, and occupied lesson intervals to return selectable six-week openings that prefill the existing composer.
- Preserved direct calendar add mode and an explicit `Add without finding a time` escape hatch while the broader composer is refined.
- Finder validation passed: TypeScript, ESLint, production build, and all 60 local Node tests.
- Replaced the initial six-week result list with a filter-driven weekly picture and week picker. Teacher-only selection immediately exposes free blocks; service duration, day, and time progressively narrow those same possibilities in any selection order.
- Darkened the filter control surface and removed competing underlines/dividers around the finder controls and results.
- Weekly finder validation passed: TypeScript, ESLint, production build, and all 60 local Node tests.
- Seeded isolated staging with three realistic demo teachers, four unbilled demo students, six teacher availability blocks, and thirteen normal-RPC lessons to exercise weekly filtering. Verified the demo students have zero billing-account links and recorded that all payment testing remains on the Jonathan/test-student/test-payer path.
- Changed lesson-finder results from generated start-time increments to continuous teacher availability windows. Offering duration now mutes too-short windows without hiding them, and past/today constraints apply consistently with or without a selected offering.
- Unified direct calendar lesson creation: five-minute hover/click in planner day/week views, date-only month clicks, teacher context propagation, explicit student primary-teacher defaults, and pre-submit conflict disabling with loud invalidation when later choices make a selected time unavailable.
- Softened the planner's cursor-following time label with a low-contrast surface, muted text, and a faint outline while preserving five-minute precision.
- Reorganized the planner header controls: compact view choices sit beside the calendar heading, the smaller Add lesson button follows them, and the teacher chooser sits below a reduced Expand all teachers control in a header-height stack.
- Merged teacher display into one ordered selector (All teachers, Expanded all teachers, then individuals), moved timezone into quiet calendar-nav metadata, centered Previous/Next together, and made the return-to-current-period action conditional and left aligned.
- Kept the current UI iteration local: moved the teacher selector left of Add lesson, bottom-aligned and reduced all header controls, added dark calendar chrome around the heading/navigation while preserving the grid surface, removed the navigation divider, offset the 8:00 AM label from the grid boundary, and renamed the current-period action to “Jump back…”.
- Added localhost and 127.0.0.1 port 3001 callbacks to the persistent staging Auth redirect allowlist so local UI sessions return to the local development server instead of staging.
- Continued the local calendar styling pass: replaced the fixed dark chrome with the same theme-aware canvas surface used by the finder filters, extended that surface around all sides of the grid, kept only timeline/month cells on the lighter raised surface, and restored theme-aware grid/control text colors.
- Moved the teacher selector into the left side of calendar navigation, moved the conditional “Jump back…” action to the right, and removed the redundant timezone note from the calendar entirely. This UI pass remains local.
- Simplified the local teacher display control by removing its visible label, darkening its background one tonal step, enlarging the selected value, and relying on the native select caret as the affordance.
- Removed vertical grid separators from the week/day column headings and month weekday labels; grid lines now begin with the calendar cells. This UI pass remains local.
- Added a consistent custom visual treatment to all native select triggers (tight spacing, custom caret, focus ring, and themed options) while preserving native keyboard/mobile behavior. Removed Expanded all teachers from the teacher data list and made it a week-layout icon toggle beside All teachers. This UI pass remains local.
- Refined the expanded-teacher layout control into a two-position switch: compact, closely spaced columns on the left and wider, heavier columns on the right. This UI pass remains local.
- Enlarged the teacher-layout switch and its column glyph by roughly 20%, and doubled the transition duration so the expansion animation is easier to perceive. This UI pass remains local.
- Widened the teacher-layout switch to make its state travel more obvious. In expanded week layout, each day/date now appears once across its teacher group, with the individual teacher names labeling the columns below. This UI pass remains local.
- Widened the layout switch again and added a contextual Compact/Expanded label in its open side. The label hides during the thumb/column transformation, changes sides with the active state, and fades back after the motion completes. This UI pass remains local.
- Animated the calendar grid alongside the layout switch: expanding grows the new grid horizontally into place, compacting settles it inward, and both transitions use a brief opacity/softness change with reduced-motion support. This UI pass remains local.
- Made Compact/Expanded a density choice for every week selection, not only All teachers. A single selected teacher can now use expanded mode, which materially widens each day column and adds the lesson time directly to each block for at-a-glance reading. This UI pass remains local.
- Increased the teacher selection row's maximum width by 50% so the teacher dropdown has more room beside the layout switch. This UI pass remains local.
- Persisted the planner's Compact/Expanded week-density preference in school-scoped local storage. It now survives refreshes, teacher changes, and switching away from and back to week view without adding a database-level user setting. This UI pass remains local.
- Muted and desaturated the dashboard's Needs scheduling card when no paid lessons require scheduling, while leaving actionable/populated states at full emphasis. This UI pass remains local.
- Moved dashboard invoices above the school matrix. Simplified the matrix to sit directly on the page background, removed the redundant Arrange columns mode while retaining always-available header dragging, and removed the horizontal-scroll arrow bar and its divider rules. This UI pass remains local.
- Swapped the school-header utilities: School settings now occupies the small link beneath the school identity, while Setup guide sits on the right beside the account menu. This UI pass remains local.
- Moved Setup guide into the School settings navigation and removed its dashboard-header control, enlarged the account avatar, and moved calendar Previous/Next to the right with the conditional Jump back action centered. This UI pass remains local.
- Unified all shared dashboard section headings at one 3xl scale. Made invoice placement urgency-aware: open invoices render directly below Needs scheduling, while a settled invoice summary remains below the calendar. This UI pass remains local.
- Brought the Find an opening heading onto the same 3xl size, weight, and tracking used by the other dashboard section headings. This UI pass remains local.
- Converted Find an opening from an always-open inline panel into a large centered launch button with icon and explanatory copy. The full weekly filter/results interface now opens in a wide, scrollable modal with backdrop, Escape/Close handling, focus return, and automatic close after choosing an opening. This UI pass remains local.
- Separated the Find an opening launcher from the calendar card entirely and constrained it to a large centered 34rem button, leaving the calendar as its own independent section below. This UI pass remains local.
- Moved the centered Find an opening launcher above Needs scheduling by adding an explicit pre-calendar content slot to the planner; Needs scheduling and any urgent invoice card now remain between the finder and calendar. This UI pass remains local.
- Restored Needs scheduling and urgent invoices above the finder launcher. Strengthened the centered Find an opening button's hover with lift, scale, brand outline, brighter surface, and a deeper shadow. This UI pass remains local.
- Replaced native browser select popups throughout production and the interaction study with one reusable AppSelect control. Menus now open from a fixed anchor directly beneath the trigger, with consistent spacing, theming, disabled/selected states, scrolling, outside-click/Escape handling, keyboard arrows, and native form-value compatibility. This UI pass remains local.
- Expanded the dashboard quick-launch area into a responsive row of three matching large buttons: Find an opening, Add student, and Add payer. The latter two reuse the existing atomic student+payer creation workflow with tailored titles and explanations; payer creation explicitly includes its required first student. This UI pass remains local.
- Completed the symmetrical dashboard entry flows. Add student can connect a new student to an existing payer or create a new payer; Add payer can connect a new payer to an existing unconnected student or create a new student. Added an atomic, capability-checked, idempotent, audited database function for the existing-student path while preserving one billing account per student. This change requires applying the new migration before end-to-end testing.
- Validation passed for TypeScript, ESLint, and diff whitespace. Local Supabase DB lint could not start because the CLI cannot parse the repository's `.env.local`; staging was intentionally left unchanged during this local UI phase. Apply `20261013143000_create_payer_for_existing_student.sql` before testing the existing-student payer path.

## 2026-10-22 — Separate billable offerings from scheduled lesson details

- Audited the offering, lesson, recurring-series, teacher-approval, replacement-lesson, portal, and billing paths after the location-model discussion.
- Confirmed offerings remain billable definitions only: name, format/capacity, duration, scheduling default, billing timing, and price. They do not own an instrument or place.
- Added an explicit school instrument to lesson occurrences, recurring-series defaults, and outside-availability proposals. New scheduling requires it; historical rows are inferred only where a teacher has exactly one active instrument and otherwise remain honestly unknown.
- Carried instruments through weekly occurrences, teacher-approved proposals, proposal replacements, and retained/replacement lessons. Owners may schedule an instrument outside a teacher's listed specialties as a visible exception; it is guidance, not a hard wall.
- Made Student home and Online built-in scheduling choices. New configurable places are school rooms only, managed under School Info; legacy other-place records remain for historical references but are excluded from new scheduling.
- Kept instrument and place out of billing calculations and immutable price snapshots. Owner/student/family/teacher drawers and the payer portal display instrument separately from the offering.
- Added migration invariants that fail if offerings acquire scheduling columns, recurrence/proposal propagation disappears, or authenticated callers regain an instrument-free lesson creation RPC.
- Typecheck, ESLint, and the production build pass. There is no generic `npm test` script. Persistent staging accepted migrations `20261022230000` and `20261022231000`; the invariant migration passed. Linked database lint reports only two pre-existing unrelated unused-variable warnings. Local clean replay is unavailable because Docker is not installed.

## 2026-10-23 — Move cadence entirely into scheduling

- Removed the offering-level “usual scheduling” choice and the legacy hidden sessions-per-interval cadence fields.
- Offerings now describe only the billable lesson/class: name, format/capacity, duration, price, and billing timing.
- Normal lesson creation defaults to a weekly series, replacement lessons remain one-time, and the owner chooses Weekly or One lesson in the scheduling flow. Changing the offering no longer changes that scheduling choice.
- Offering lists no longer show a guessed weekly cadence or four-week estimate. Student roster language now reflects the actual occurrence: Weekly series or One lesson.
- Migration `20261023090000_move_cadence_to_scheduling.sql` removes the four cadence columns and verifies recurrence remains on `lesson_series`.

## 2026-10-23 — Prospects, waitlist, and roster intake discovery

- A beta tester's existing roster surfaced the need to track people before they become active students or billing families.
- Preserve the existing domain distinction: an inquiry or waitlist entry must not silently create an active billing account, payer portal access, invoices, or payment setup work.
- Build a lightweight prospective-contact pipeline with clear stages such as New inquiry, Waitlist, Ready to enroll, Enrolled, and Not moving forward. A prospect may include a prospective student and responsible contact, but incomplete details must be allowed.
- Enrollment should be an explicit conversion that reuses the existing connected student/payer creation flow, carries forward known contact information, and keeps a history of the earlier inquiry/waitlist state instead of requiring duplicate entry.
- Future roster ingestion should map imported records into this reviewable prospect pipeline first. Google Docs should not be treated as a durable integration source; accept a structured CSV/export or a deliberate reviewed import before creating records.
- This is queued behind the current staging-first scheduling release and production acceptance tests for scheduling, invoice approval/payment, cancellation, and rescheduling.

## 2026-10-23 — Inline instrument recovery while scheduling

- Staging acceptance confirmed that the separated offering, instrument, place, and cadence choices are understandable in the normal lesson flow.
- When a school has no instruments, lesson creation now says so and offers `+ Add an instrument` in place, matching the established school-room recovery pattern.
- Saving the instrument preserves all entered lesson details, adds it to the school catalog, selects it immediately, and confirms the result with the shared toast pattern.
- Find an Opening now centers and emphasizes its week picker. Previous/next are recognizable bordered buttons rather than bare arrow glyphs, while the current weekly range remains the primary label.
- Header Invoices, Approvals, and Notifications controls now receive a slow, low-contrast traveling border/glow only while their respective queues contain something requiring attention. The cue becomes static for reduced-motion preferences and disappears when the queue is clear.
- Moved the compact Find an opening and Prepare invoice actions into the right-side utility cluster directly above Invoices, Approvals, and Notifications, keeping the primary section tabs visually separate from operational shortcuts.
- Refined that header hierarchy into two full rows: Find an opening and Prepare invoice occupy the right-aligned top row; the former primary row moves below with section tabs on the left and the three attention queues on the right.
- Restored discoverability of named lesson spaces by moving the existing school-room manager from School info into Lessons & classes as `Lesson places`; Student home and Online remain built-in scheduling choices. Setup guide is now an icon button opposite the School setup heading instead of a settings subtab. The guide's final walkthrough now explains how published cancellation policies guide requests while preserving owner judgment, documented exceptions, and connected accounting outcomes.

## 2026-10-26 — Production setup promotion and contextual notifications

- Promoted the accepted lesson-place/settings/setup-guide batch through PR #113 as production commit `7927a19`. The Vercel production deployment is Ready at `app.commontime.studio`; the public login smoke passed.
- Audited owner-notification producers. New lesson alerts now record student, teacher, offering, scheduled date/time, duration, and whether the booking is one lesson or a weekly series. Existing replacement-lesson enrichment remains responsible for identifying rescheduled/replacement lessons and their original time.
- New lesson alerts open the exact lesson drawer. A central database trigger also routes lesson-change requests and teacher proposals to the exact approval, invoice approval/review responses to the exact invoice, and other lesson-event alerts to the exact lesson. Existing alert destinations were repaired without rewriting their historical text.
- Delivery wording now says `Teacher email queued`, which is the state transactionally proven when the notification is created; it does not falsely claim inbox delivery. The calendar statement is likewise true because the alert is created inside the successful lesson-creation transaction.
- Commit `aa92b81` was deployed on staging and PR #114 passed application, browser, clean-database replay, database-lint, and authorization CI before merging as production commit `26e960b`. Exact staging ref `iubmheectmsoavztbzma` and production ref `twhexxokrjwzsoxgzlme` both report migrations `20261026150000` and `20261026151000`; both Vercel deployments are Ready and the production login smoke passes.
- Next human acceptance: create one new production lesson and verify its alert contains every scheduling detail and reopens that exact lesson drawer. Continue with that lesson through invoice preparation, lock, payer approval, charge, and payer cancellation/rescheduling; do not repeat already-passed setup checks.
- Production invoice composition acceptance — 2026-10-26: the owner prepared an invoice containing the newly created one-time lesson alongside the month’s weekly occurrences. The one-time lesson appeared exactly once, the other monthly lesson lines remained present, and the invoice locked successfully. The dashboard now reports one invoice in progress. Next test: send this exact locked invoice for payer approval and verify the payer receives and approves the same itemized amount.
- Production approval-delivery acceptance — 2026-10-26: the owner sent the locked invoice for approval and the payer email arrived. The existing path required leaving the dashboard for the family record, scrolling to the invoice, and pressing a plain email button. The next staging UI pass keeps the dashboard as the base of operations: the whole invoice row opens an in-place workspace with line items, adjustment/lock/send/collect controls appropriate to its current state, payer/student context, and a quiet deep link to the full family record. Invoice lists sort by status, payer name, or student name. All approval-email actions, including resend/replacement on the family page, now require hold-to-confirm. Typecheck, lint, 65 invariant tests, and the production build pass.
- Approval-email transparency follow-up — 2026-10-26: future approval emails show the locked invoice before the payer clicks: student-grouped line items, lesson count per student, dates, charges/credits, and total. The CTA explicitly says `Review, approve, or request changes`; the secure approval page remains the only place that records either decision. Initial sends and retries fail closed if the exact itemized invoice cannot be loaded. The already-delivered production email remains valid and does not need to be resent for the active test.
- Production promotion — 2026-10-26: PR #115 merged as production commit `26731c0`. Dashboard invoice workspaces, sortable invoice queues, hold-to-confirm approval sends, and itemized approval emails are live. All required CI checks passed; Vercel deployment `dpl_9xXCVANWE2aAHSwvn691gSSDVtBc` is Ready and the canonical login returns 200. The active invoice should now test `request changes` because approval-through-charge has already passed repeatedly.
- Payer change-request completion UI — 2026-10-27: the production request-changes action succeeded, but the refreshed phone view misleadingly led with `Statement unavailable`. The rejected-request state now confirms that the school received the change request and that nothing was charged, while retaining the original invoice as a faded, noninteractive record with a diagonal `Sent back for review` stamp. Truly expired, cancelled, or superseded statements retain the unavailable treatment. Typecheck, lint, 65 tests, and production build pass; deploy through staging before production.
- Owner invoice-review visibility — 2026-10-27: clicking a payer-review notification now opens the shared invoice workspace modal over the current owner page instead of navigating to the family record. Dashboard invoice cards and the header invoice queue override the generic editable `In review` label with `Sent back for review`, and surface the payer’s reason/note directly in a contrasting request box. The family record automatically expands rejected invoices and gives each a strong red review-return tag and reason. The database lifecycle remains `review` (editable by the school); the UI now distinguishes the payer-triggered reason for entering that state. Typecheck, lint, 65 tests, and production build pass.
- Production promotion — 2026-10-27: PR #116 merged as production commit `e4aba86`. The payer’s stamped sent-back confirmation and the owner’s modal/card/family review-request treatment are live. Required browser, database, verify, Supabase Preview, and Vercel checks passed; production deployment `dpl_DodkLsSVc5UDYzC3C86J1w3rGCA3` is Ready on `app.commontime.studio`, and canonical login returns 200.
- Approval-to-portal handoff — 2026-10-27: the secure invoice-review page remains a single-purpose token page, not a full family-portal login. Every invoice state now offers an explicit portal CTA. If an authenticated session cookie is present it says `Go to family portal` and confirms the device is signed in; otherwise it says `Log in to family portal` and warns that email verification with a one-time code comes next. The invoice token never silently grants broader portal access. Typecheck, lint, 65 tests, and production build pass.
- Authenticated portal invoice decisions — 2026-10-27: pending itemized invoices in the family portal now offer the same two payer choices as the no-login email link: hold to approve the exact amount, or send it back with a structured reason and optional note. Portal decisions are separate authenticated RPCs bound to the verified email’s private `payer_portal_authorizations` record, current ready access state, exact school/account/period, latest request, pending status, unexpired request, and unchanged amount. Events use the existing `in_app` channel with `surface=client_portal`; owner notifications and emails remain shared. Approval never charges the card. Staging migrations `20261027110000` and `20261027111000` are applied and their grant/boundary verifier passed. Database lint reports only the two pre-existing unused-variable warnings; typecheck, lint, 65 tests, and production build pass.
- Planning checkpoint — 2026-10-27: queued expansion of the minimal platform-admin area into audited school/customer, beta-term, trial/free-month, plan, and account-status controls. Also queued a reversible solo-school operating mode that preserves the full school model while supplying owner-teacher defaults and reducing unnecessary multi-teacher UI. Possible `$8` solo and `$20` up-to-five-teacher tiers are discussion inputs only; pricing, limits, upgrade behavior, and exact solo conveniences remain intentionally undecided.
- Invoice-adjustment UI — 2026-10-27: separated invoice adjustments from the final lock action with a highlighted launcher and dedicated raised editing area. Saving or cancelling ends editing; while the editor is open, hold-to-lock is disabled and explains what must be completed. The guard is shared across the dashboard invoice workspace and both invoice-preparation flows. Typecheck, lint, 65 tests, and production build pass. Commit `85af922` is on staging; its Ready Vercel deployment was manually assigned to the normal staging alias because that alias had remained on a stale four-day-old preview.
- One-time invoice payment foundation — 2026-10-27: added a Stripe-hosted, non-reusable card payment path for exact approved invoices. The payer can approve and then pay from the secure review page; an owner can copy the short-lived link from an approved invoice workspace without seeing or entering card details. The request reserves the invoice, is exact-amount and tenant bound, deliberately keeps the reusable family Stripe Customer out of Checkout, settles only through verified Stripe events, synchronizes approval payment status, and releases expired attempts. Staging migrations `20261027130000` and `20261027131000` are applied and verified; typecheck, lint, 65 tests, the production build, and staging deployment passed. Feature commit `ff2309a` is live on the familiar staging alias for acceptance.
- Created approved/unpaid `$2.00` staging fixture `One-time payment link test` for TestFamily (period `4e70cf36-99f5-4686-88b9-4acc4cdaa1d0`, approval `d0dac1a3-8fcb-4bf3-8b9b-92aa407119ac`). It exists solely for one-time Checkout acceptance and must not be collected through the saved-card action.
- One-time Checkout acceptance succeeded for that fixture: verified webhook settlement marked its period, attempt, and Checkout request paid/succeeded. Added explicit copied/copy-again feedback and exact-attempt polling in the invoice modal, with success and recorded-failure messages plus a manual-refresh fallback. The family payment card now auto-refreshes during active attempts as well, covering saved-card and hosted Checkout outcomes. Typecheck, lint, 65 tests, and production build pass.
