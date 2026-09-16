# Beta flow audit — 2026-09-15

## Result

The invitation-only beta path is coherent from school invitation through setup, daily scheduling, teacher work, family access, statement review, and payer approval. One release-blocking mismatch was found and fixed: anti-phishing email copy directed payers to verify a statement in the portal, but the portal did not display statements. The portal now loads only sent-or-later statements for billing accounts authorized to the verified payer email, including safe itemized lines and separate approval/payment states.

No beta blocker remains in the audited application flow. Live charge execution and production SMS remain intentionally unavailable and must not be represented as beta features.

## Evidence

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run build -- --webpack`: pass; all application routes compiled and 19 static routes rendered.
- `git diff --check`: pass.
- Linked Supabase database lint: no errors; two existing unused-variable warnings only (`queue_payer_response_notifications.school_name` and `resolve_owner_lesson_change_request.actor_role`).
- Database verification migrations passed for school email reply identity, service-only public token RPCs, expired demo-token removal, and payer portal statements.
- Public DNS was inspected separately in the email authentication runbook. DNS enforcement work remains operational, not an application-flow defect.

This audit used source, schema, migration assertions, linked database lint, and production compilation. It did not send real messages, mutate provider accounts, or execute a live payment.

## Flow matrix

| Area | Result | Verified behavior | Beta note |
|---|---|---|---|
| Platform invitation | Pass | Platform-admin authorization, email-bound 14-day token, digest-only storage, reissue behavior, rate limit | Invite remains manually issued from `/admin` |
| Owner sign-up | Pass | Invitation checked before Auth user creation; one-time code; invitation email fixed; ordinary self-signup remains closed | Public signup is future work |
| School creation | Pass | Authenticated invite claim; owner membership; duplicate-safe database boundary; timezone and name validation | Trial periods are not implemented |
| Guided onboarding | Pass | Branding, avatar, first atomic student/payer, instruments, teachers, billing explanation; resumable state; completion requires a student | Logo/avatar/teachers may be completed later |
| Owner workspace | Pass | Capability-backed dashboard, week calendar, schedule-needed queue, School overview, invoices, approvals, notifications | Week is the primary view by design |
| Student/family/staff records | Pass | Connected names link to details; student/family calendars; teacher details, settings, availability, invitation state | Teacher financial context is still a roadmap item |
| Lesson creation | Pass | Owner capability, validated inputs, collision checks, availability path, recurring/single scheduling | Substitute-teacher and standalone makeup controls remain deferred |
| Rescheduling | Pass | Owner apply flow, teacher apply/propose authority, stale/conflict handling, immutable replacement history | Family self-service stays policy-gated |
| Outcomes/cancellations | Pass | Owner and assigned-teacher outcome entry, policy preview, owner decisions, owed-lesson creation | Schools must publish their real policies before billing affected months |
| Teacher workspace | Pass | Assignment-scoped calendar, proposal decisions, availability, outcomes, cancellation reporting | A real invitation acceptance rehearsal is still recommended |
| Family authentication | Pass | Uniform OTP request response, verified-email authorization, ambiguous-account stop, no ordinary user creation | Exact payer email must match the school record |
| Family calendar | Pass | Relationship-scoped upcoming lessons and private rotatable subscription | Subscription URL must be treated as a secret |
| Family statements | Pass after fix | Authorized sent/approved/collecting/paid/failed periods; safe line items; distinct approval/payment labels | Drafts and internal review states are intentionally hidden |
| Billing draft | Pass | Itemized per-family draft, blockers, adjustments, credits, unlock/revision, locking | Bulk billing is not the primary beta path |
| Payer approval | Pass | Exact amount/version token, approve/reject, supersession, old-link invalidation, noindex/no-referrer | Approval never means payment |
| Automatic-payment permission | Pass with rehearsal pending | Separate mandate, cap, notice period, portal revocation, append-only evidence | Do not describe this as active collection yet |
| Payment execution | Intentionally gated | Saved-method and provider foundations exist; no live/test charge action is exposed | Not part of the beta acceptance path |
| Transactional email | Pass in app | Authenticated From invariant, sanitized display name, school Reply-To, canonical links/safety copy, durable delivery state | DMARC/tracking DNS operations must be completed before payer invitations |
| SMS | Test foundation only | Consent evidence, STOP/START/HELP, signed callbacks, safe retry behavior | Requires a school-specific approved Twilio program before production use |
| Webhooks | Pass by construction/history | Raw-body signature verification, replay dedupe, provider-object binding, service-role processing | Re-run live provider replay suite before payment execution |
| School settings/media | Pass | Capability checks, validated logo/avatar uploads, contact reply email, catalog, places, policies, appearance | Large image files are rejected before storage |
| Help and operating docs | Pass after fix | Public in-app help plus owner, teacher, payer, and quick-start guides | Keep guides synchronized with flow changes |

## Open items that do not block the first beta school

- Complete DNS DMARC enforcement and confirm Resend click/open tracking is disabled using the email authentication runbook.
- Perform one cold invitation/onboarding run using the beta tester’s exact email after this branch is deployed.
- Perform one real teacher invitation acceptance and one payer portal code login with test data.
- Rehearse a delivered statement, payer rejection, corrected replacement, and approval without attempting a charge.
- Resolve the two harmless database-lint unused-variable warnings during normal schema maintenance.
- Keep production SMS and payment collection disabled until their provider-specific gates are complete.
