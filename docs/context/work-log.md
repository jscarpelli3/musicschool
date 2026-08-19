# Work Log

Use this file for short chronological notes about meaningful work.

## 2026-08-19 — security audit program and payer portal hardening

- Established `docs/audits/security-audit-log.md` as the living, append-only master security due-diligence record. It defines scope, procedure, evidence requirements, severity/retest rules, process-change history, recurring TODOs, and the first detailed audit run.
- Logged the payer-portal boundary findings and local remediation: payer-account-only authorization, private per-school email bindings, cross-school reuse, same-school duplicate denial, owner/admin-only silent Auth provisioning, no portal self-signup, explicit access states, local-only logout, and database regression assertions.
- Recorded the remaining deployment and live-test gate accurately. TypeScript, focused lint, and production build pass; Supabase migrations and live adversarial checks remain blocked until CLI authentication is restored.
- Expanded the master audit process with dedicated Stripe and Resend API regression suites and baseline/automation TODOs. The suites cover configuration, authorization and tenant/object binding, signatures, replay/concurrency/order, idempotency, ambiguous provider failures, retries/suppression, safe logs, and provider-state reconciliation.
- Deployed payer-portal migrations `20260819113000` and `20260819114000`; the database boundary assertions passed and linked lint has no new finding. Cleaned the reachable test email down to one Davis family binding, preserved historical evidence, confirmed its silent Auth identity, and verified the live access state is `ready` with exactly one active authorization.

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
