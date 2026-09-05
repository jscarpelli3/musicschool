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
