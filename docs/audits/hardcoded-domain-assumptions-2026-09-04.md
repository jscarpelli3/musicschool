# Hardcoded Domain Assumptions Audit — 2026-09-04

Scope: database transactions, Server Actions/provider workflows, and interaction UI. The governing rule is that initiator, interaction channel, business scenario, service truth, financial treatment, replacement service, and communication state are independent facts.

## Release blockers

1. The current owner request resolver writes every approved cancellation as `student_cancelled` and selects student cancellation rules regardless of scenario. Do not expose teacher or school cancellation submission until resolution selects `cancellation_policy_outcomes` by immutable policy version, scenario, and timing bucket.
2. The legacy decision-revision adapter also stamps student service truth. Replace it with scenario-driven canonical revision creation before any non-family request can reach it.
3. Owner review presentation and choices are family-specific and UI-owned. The server must return scenario-specific recommendation, allowed actions, consequences, and notification audiences; the UI renders that contract.

## High priority

1. Replace TypeScript policy recomputation in `owner-approvals.ts` with persisted scenario-aware decision preview.
2. Unify owner, teacher, family, and system rescheduling behind one authenticated domain command. Interaction channel and initiator must not be encoded into reason strings or a generic `source` literal.
3. Make family portal submission a thin adapter over the same scenario-aware request command used by other origins.
4. Give school cancellation its own versioned policy recipe or explicitly snapshot its inheritance from teacher-cancellation policy.
5. Make policy recipe generation fail or verify equality on conflicts instead of silently retaining potentially stale derived rows.

## Structural follow-up

1. Move Resend delivery reconciliation away from a route-level list of outbox tables toward a shared delivery identity/registry.
2. Replace duplicated UI/action role arrays with server-derived capabilities while retaining RLS as the final authority.
3. Move planner reason codes and request choices into shared domain contracts; never combine origin and reason in a single encoded string.
4. Replace implicit calendar-status filtering and permissive unknown-status display with shared exhaustive state descriptors.

## Immediate correction

Migration `20260904131000_stop_inferring_scenario_from_origin.sql` removes origin-based scenario inference introduced in the preceding foundation migration. Only the existing family compatibility path may derive student cancellation versus reschedule from its explicit request action. Teacher, owner, and system callers must provide scenario explicitly.

Migration `20260904132000_gate_legacy_student_resolution.sql` renames the existing implementation as an internal student-only compatibility function and places a scenario-aware authorization gate at the public RPC signature. Any teacher-cancellation, school-cancellation, or no-show request now fails closed before the legacy transaction can write student service truth or trigger its student-only history adapter. This contains the release blocker; it does not make the legacy resolver generic.

Migration `20260904140000_scenario_driven_lesson_resolution.sql` replaces that temporary gate with the canonical transaction. It selects the immutable recipe by policy version, scenario, and timing; validates a complete actual-outcome object; derives override status; and atomically records the revision, event truth, accounting override, replacement entitlement, supported adjustment, notifications, domain event, and audit evidence. The former seven-argument RPC is now only a vocabulary adapter into this core, so it no longer writes legacy decisions or invokes the student-only history trigger. Unsupported reductions, account credits, refunds, immediate rescheduling, serviced corrections, and unresolved manual-review dimensions fail closed instead of being approximated. The migration deployed successfully and linked database lint reported no new issue.

The owner review UI now receives its allowed resolution choices and adjustment kinds from the server-owned scenario contract. The client no longer defines one universal outcome menu: teacher/school cancellations exclude keeping the original charge, and no-show review excludes replacement service. The canonical database resolver remains the final validator for every submitted combination.

Migration `20260905100000_generic_lesson_change_submission.sql` adds one private submission transaction that records origin and scenario independently, snapshots the effective policy recipe and accounting state, and creates the request, notifications, email outbox entries, domain event, and audit evidence without changing lesson or financial truth. The established family RPC is now an authorization adapter over that core, and the new assigned-teacher adapter proves the authenticated teacher assignment before submitting `teacher_cancellation`. Pending-request uniqueness is scenario-based rather than request-type-based. The teacher portal exposes this as an owner-review report, never as an immediate financial outcome. The migration deployed successfully; type-check, lint, production build, and linked database lint reported no new issue.

This closes release blockers 1–3 and high-priority item 3.

Migration `20260905110000_unified_occurrence_reschedule_command.sql` consolidates actual occurrence moves behind one private transaction. Owner and assigned-teacher wrappers retain their distinct authorization and approval behavior, but both now delegate calendar mutation, conflict detection, immutable history, policy-version evidence, domain events, and audit evidence to the same command. Origin and interaction channel are explicit inputs. Family rescheduling correctly remains a different domain operation: it requests policy-governed replacement service rather than inventing a destination time or directly moving the occurrence. Migration `20260905111000_allow_teacher_schedule_change_source.sql` adds that truthful interaction channel to history instead of coercing it to `calendar`; `20260905112000_verify_unified_occurrence_reschedule.sql` asserts wrapper delegation and prevents authenticated callers from bypassing authorization through the private core.

This also closes high-priority item 2 for existing reschedule entry points.

Migration `20260905113000_school_cancellation_submission.sql` adds the owner/admin authorization adapter for an explicit `school_cancellation` scenario. It delegates to the same submission core as family and teacher origins and leaves the occurrence, service result, charge, replacement, adjustment, and refund untouched until review. The owner calendar and teacher portal now render the same configurable report interaction rather than maintaining channel-specific confirmation logic. Request-email delivery is deduplicated by request and normalized recipient address, so a staff requester who is also a derived recipient receives one message rather than channel-dependent duplicates.

This closes high-priority item 4 at the submission layer: school cancellation has an explicit versioned outcome recipe and immutable snapshot rather than inheriting from origin. The next domain-flow work is policy-recipe conflict verification. Structural follow-up remains the generic delivery registry, capability-derived UI/actions, shared reason/status contracts, and exhaustive calendar state descriptors.
