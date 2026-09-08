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

This closes high-priority item 4 at the submission layer: school cancellation has an explicit versioned outcome recipe and immutable snapshot rather than inheriting from origin.

Migration `20260905120000_verify_policy_recipe_conflicts.sql` replaces silent recipe-conflict retention with exact equality verification. Re-running derivation for the same policy version remains idempotent only when school, calendar, service, original-charge treatment, replacement, teacher constraint, transferability, expiration, adjustment, review requirement, and guidance all match. Any difference reaches the immutable guard and aborts the surrounding publication transaction with `cancellation_policy_outcome_recipe_conflict`; existing rows are never silently repaired or overwritten. Deployment also regenerated all seven recipes for every existing policy version, proving the linked data already matched its versioned rule inputs.

This closes high-priority item 5. The domain-flow blockers and high-priority corrections in this audit are now complete.

Migration `20260905130000_generic_email_delivery_registry.sql` introduces one provider-identity and delivery-state registry across billing approvals, owner notifications, lesson creation, lesson-change requests, teacher invitations, and schedule proposals. A protected source catalog drives generic projection updates; registration triggers attach new provider IDs without requiring webhook code changes. Signed Resend events now reconcile through the registry, including events received before provider submission finalization, while the former domain outboxes remain readable projections. The webhook route no longer contains a hardcoded fan-out over outbox table names. Migration `20260905131000_verify_generic_email_delivery_registry.sql` proved complete historical backfill, event linkage, and source-trigger coverage in the linked database.

The generic delivery-registry structural item is complete.

Migration `20260906100000_school_capability_grants.sql` starts the access-model conversion with a protected capability catalog, data-owned role defaults, explicit per-member grants or denials, and authenticated capability-query functions. Denials take precedence over role defaults. The school navigation and primary workspace now render lesson management, approvals, staff, setup, and teacher-workspace routing from capabilities rather than role-name arrays; role remains visible identity context and RLS remains the final authority. Migration `20260906101000_verify_school_capabilities.sql` verifies catalog/default completeness, RPC availability, and that authenticated clients cannot read or mutate grant internals directly.

The secondary setup/detail pages and their Server Actions now use the same capability checks for appearance, lesson management, approvals, billing, policies, products, places, staff administration, teacher records, student support, and the teacher workspace. Application authorization no longer contains owner/admin/teacher arrays; the remaining `membership.role` rendering is identity context only. Type-check and lint pass.

Migration `20260908120000_capability_backed_database_authority.sql` rewrites the active RLS policies for product, place, policy, billing, approval, entitlement, and lesson-management tables from role arrays to their domain capability. Place creation remains independently grantable from managing every place. The same migration rewrites the active billing-draft, billing-lock, policy-publication, family-policy, lesson-creation, entitlement-scheduling, and lesson-resolution RPC authorization gates. It operates transactionally against the live PostgreSQL catalog and fails closed if an expected predicate cannot be replaced. Migration `20260908121000_verify_capability_backed_database_authority.sql` prevents those converted policies and functions from silently returning to role-array authority; both migrations deployed successfully and linked database lint passes.

Migrations `20260908122000_mixed_school_capability_authority.sql` and `20260908123000_capability_scheduling_branches.sql` complete the mixed-authority conversion for staff administration, teacher-record settings, school-initiated cancellation, lesson rescheduling, outside-availability proposals, proposal review, and weekly availability. Management branches now use domain capabilities, while assigned-teacher branches still prove the actor's teacher record, assignment, and per-teacher settings. Role remains audit/notification context rather than the permission decision. Migration `20260908124000_verify_mixed_school_capability_authority.sql` locks those distinctions in place. All three migrations deployed successfully; application type-check and lint plus linked database lint pass.

The shared-contract follow-up has started in `lesson-domain-contracts.ts`. Owner scheduling, planner interaction, and family portal actions now consume one typed reschedule-reason, request-type, and requested-remedy vocabulary. Lesson event states have exhaustive descriptors that own display labels and whether an event occupies the calendar. This removed a real divergence where `rescheduled` events were excluded from conflict detection but still rendered in day/week calendar views. Unknown event states now fail explicitly instead of being humanized and displayed as if supported. Type-check and lint pass.

Remaining structural work is to move the legacy `code::detail` reschedule transport into independent RPC fields and extend exhaustive descriptors to proposal, request, billing, and delivery states.
