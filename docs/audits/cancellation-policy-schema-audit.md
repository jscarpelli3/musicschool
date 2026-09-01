# Common Time cancellation policy and resolution schema audit

This is the living source of truth for how Common Time represents cancellation, reschedule, no-show, teacher-cancellation, replacement-service, fee, credit, refund, exception, correction, and notification decisions.

The goal is a human-centered system: policy recommends the normal result, the owner makes the individual business decision, and the application preserves accurate service, accounting, authorization, and historical evidence.

This document is an engineering and product audit. A proposed model is not live merely because it appears here. Every implementation checkpoint must distinguish local code, deployed schema, automated evidence, and live acceptance.

## Audit record

| Run | Date | Environment / commit | Evidence | Result |
| --- | --- | --- | --- | --- |
| CPS-001 | 2026-08-31 | Production schema through `20260828151000`; application through `90711be` | Source inspection of policy, portal request, owner resolution, entitlement, billing disposition, adjustment, refund, notification, RLS, and audit paths | Baseline complete; redesign required before expanding owner resolution UI |
| CPS-002 | 2026-08-31 | Production migrations `20260831120000` and `20260831121000`; application schema types generated from linked database | Backfill/pointer/RLS/grant migration assertions, matching local/remote history, linked lint, TypeScript, ESLint, and diff checks | Vocabulary/compatibility and decision-revision schema deployed; live owner-decision rehearsal pending |
| CPS-003 | 2026-09-01 | Production migration `20260901110000`; family policy and portal application changes local | Migration assertions, server-authoritative preview inspection, TypeScript, ESLint, diff checks, production build | Rules-matrix access foundation deployed; automatic decisions and refunds remain fail-closed pending complete transaction paths |

## Product invariants

1. A policy is a versioned recommendation, not an unalterable command.
2. The owner, and an explicitly authorized admin, may make a case-specific business exception.
3. The system must never claim that a lesson occurred when it did not occur.
4. Family-facing wording may say a late-cancelled lesson is “counted as serviced,” but internal service truth remains `not_serviced` and billing truth separately records that the original charge remains.
5. Calendar state, service truth, replacement entitlement, original billing treatment, additional adjustment, collected-money remedy, and communication are separate decisions.
6. Business flexibility does not override tenant isolation, actor authorization, legal consent, provider truth, idempotency, conflict safety, or preservation of evidence.
7. Submitted requests and published policies are immutable snapshots. Corrections append revisions or compensating actions; they do not erase the original decision.
8. A payer sees a concise statement of the actual result. Internal policy codes, billing machinery, and staff-only explanations remain private.
9. No UI-only restriction establishes safety. Server validation and database authorization must independently enforce scope and invariants, with RLS as a backstop.
10. A provider failure cannot silently discard an accepted request, decision, email intention, charge, credit, or refund.

## Current model

### Published policy

`school_policies` and `school_policy_versions` provide school-scoped, effective-dated, immutable published versions. `cancellation_policy_rules` currently contains:

- cancellation and reschedule cutoff hours;
- timely and late billing dispositions;
- no-show and teacher-cancellation dispositions;
- late lesson resolution;
- optional fixed late reschedule fee;
- replacement-window days;
- same-teacher preference;
- self-service reschedule limit;
- timely and late family guidance.

The current late lesson resolutions are:

- `count_as_serviced`;
- `retain_for_reschedule`;
- `waive`;
- `manual_review`.

The name `count_as_serviced` is semantically wrong internally. The live transaction does preserve the correct facts—`lesson_events.status = cancelled`, `outcome = student_cancelled`, and an accounting override of `charge`—but the decision code itself still conflates service and billing.

### Family request

`lesson_change_requests` records an immutable-at-submission request with:

- request type and requested resolution;
- requester identity and recorded time;
- lesson, account, policy version, and lesson-start snapshot;
- cutoff and inside/outside-window result;
- policy disposition and family guidance;
- coarse accounting state;
- request lifecycle status.

Submission never directly changes a lesson or financial record. That separation is correct.

### Owner resolution

`resolve_owner_lesson_change_request` currently accepts three approval outcomes:

| Current value | Calendar/service effect | Original accounting effect | Replacement effect |
| --- | --- | --- | --- |
| `count_as_serviced` | Cancel; record student cancellation and no service | Keep charge | None |
| `retain_for_reschedule` | Cancel; record student cancellation and no service | Waive original lesson | Create one entitlement |
| `waive` | Cancel; record student cancellation and no service | Waive original lesson | None |

One optional fixed fee or credit may be added separately. A decline leaves the lesson scheduled.

The transaction correctly locks the request and lesson, rejects stale submissions, updates related notifications, writes a domain event, and queues final emails.

### Replacement service

`lesson_service_entitlements` currently records one retained lesson per source request with:

- student and billing account;
- optional assigned teacher;
- source request and source lesson;
- duration and expiration;
- a mutable current status backed by domain events for manual status changes.

It does not yet identify the lesson event that schedules or fulfills the entitlement, record transfer history, distinguish reservation from fulfillment, or prevent a status from drifting away from calendar reality.

### Financial effects

`lesson_accounting_overrides` lets the owner’s decision override policy billing computation with `charge`, `waive`, or `credit`.

`billing_account_pending_adjustments` records one fee or credit and idempotently applies it to an existing editable billing period or the next period that opens. It does not store currency independently, support multiple adjustments of one kind, model percentage/formula adjustments, or provide a compensating reversal relationship.

`payment_refunds` is a real provider-facing refund ledger with amount validation, but cancellation resolution does not safely connect a lesson line to collected funds or create a refund operation. Current policy computation maps `refund` to `credit`, which is not financially equivalent.

## Findings

### High priority

#### CPS-FIND-001 — Service and billing language are conflated

`count_as_serviced` is used as an owner decision even though the lesson is stored as cancelled and not serviced. This invites reporting errors and future developers may incorrectly treat the value as service truth.

Remediation: replace it with independent `service_outcome = not_serviced`, `original_charge_treatment = keep`, and `replacement_entitlement = none`. Reserve “counted as serviced” for payer-facing copy.

#### CPS-FIND-002 — Owner decisions are not revisionable

`lesson_change_request_decisions.request_id` is unique. A resolved request can be manually worked around through entitlement status and billing adjustments, but there is no first-class correction that supersedes the original decision and atomically applies compensating effects.

Remediation: append decision revisions with `supersedes_decision_id`, immutable before/after snapshots, reason, actor, and atomic compensating actions. Keep one derived current decision pointer or view.

#### CPS-FIND-003 — Refund and credit are conflated

The billing disposition function converts a refund policy into a credit disposition. A refund returns settled money through Stripe; an account credit creates future purchasing value. They require different authorization, amount limits, provider state, failure recovery, and communications.

Remediation: never represent `refund` as `credit`. Refund selection requires an eligible succeeded payment allocation and creates a provider refund intention. When attribution is unavailable, show “Refund requires payment review,” not an enabled automatic refund.

#### CPS-FIND-004 — Reschedule requests cannot resolve directly to a new time

The current owner transaction treats an approved request as cancellation plus zero or one entitlement. It cannot atomically move the existing lesson, propose a new time, or link a replacement event.

Remediation: add `calendar_action = reschedule_now` with proposed/selected time, conflict validation, immutable event-change evidence, and direct linkage between original and replacement events. `retain_for_later` remains available when no time is known.

#### CPS-FIND-005 — Entitlement fulfillment is not structurally linked

An entitlement can be marked `scheduled` or `serviced` without identifying the consuming lesson event. It can therefore disagree with the calendar and be accidentally reused.

Remediation: add append-only entitlement allocations/reservations linking an entitlement to a lesson event. Derive available minutes and current status from allocations and reversals rather than permitting arbitrary status alone.

#### CPS-FIND-006 — Policy fields are asymmetric and couple outcomes

Timely, late, no-show, and teacher-cancellation rules use different vocabularies. Timely policy stores only an accounting disposition; late policy adds a lesson resolution and fee; teacher cancellation mixes credit, makeup, refund, and review in one field.

Remediation: express every scenario through the same orthogonal outcome structure.

### Medium priority

#### CPS-FIND-007 — Payer intent is inferred from accounting state

The portal automatically chooses `cancel`, `lesson_credit`, or `reschedule` based partly on whether a lesson appears accounted for. The payer does not always explicitly choose the desired remedy.

Remediation: ask the payer only meaningful questions. For example, “Cancel this lesson” versus “Request another time.” Do not ask the payer to understand invoice state; store their intent separately from the owner’s remedy.

#### CPS-FIND-008 — Accounting state is too coarse

`unaccounted`, `draft`, `locked`, `approved`, and `paid` do not identify the exact line, period, payment allocation, partial collection, refundability, or whether a correction needs a new approval.

Remediation: snapshot relevant line-item and period identifiers, then compute current financial options again under lock at decision time.

#### CPS-FIND-009 — Adjustment representation is artificially singular

The owner decision permits only one fee or credit. Real cases may need a fee plus courtesy credit, multiple categorized adjustments, or a partial reversal. Current billing-line uniqueness also uses the source request in a way that cannot naturally support multiple actions.

Remediation: use an append-only collection of financial actions, each with its own ID, category, amount, currency, status, causation, and reversal link.

#### CPS-FIND-010 — Currency is implicit

Pending adjustments store cents but not currency. Today they inherit school/period currency indirectly.

Remediation: snapshot ISO currency on every financial action and verify it matches the destination billing account/period.

#### CPS-FIND-011 — Expiration starts at owner decision time

Replacement expiration currently uses `now() + replacement_window_days`. The intended anchor may instead be the original lesson time, request time, decision time, or school-defined calendar boundary.

Remediation: make the expiration anchor explicit in policy and snapshot the calculated deadline and timezone.

#### CPS-FIND-012 — Same-teacher behavior is underspecified

An assigned teacher is stored only when policy requires the same teacher. There is no distinction among required, preferred, unrestricted, or owner-selected.

Remediation: use `teacher_constraint = required | preferred | unrestricted`, plus optional teacher ID.

#### CPS-FIND-013 — Published-policy applicability needs an explicit contract

The effective version is selected relative to lesson start, then snapshotted at request submission. The product has not explicitly decided whether policy terms bind at booking, policy effective date, request time, or lesson time.

Remediation: choose and document the legal/business rule. Recommended v1: the effective policy attached to the lesson/agreement at booking governs; later policy changes do not retroactively alter it. Owner exceptions remain available.

#### CPS-FIND-014 — Final communication is too generic

Resolution email text describes the broad result but does not yet enumerate expiration, teacher restriction, rescheduled date, fee destination, credit/refund status, override wording, or provider-pending state.

Remediation: generate payer copy from a structured final-outcome snapshot and separate “decision recorded” from “refund completed.”

## Target decision model

The UI may be progressive and conversational, but the database must store these dimensions independently.

### A. Request disposition

- `declined`: leave the authoritative schedule unchanged.
- `approved`: apply the selected actions.
- `withdrawn`: requester withdrew before decision.
- `superseded`: a newer request replaced this one.

### B. Calendar action

- `leave_scheduled`
- `cancel`
- `reschedule_now`
- `retain_for_later`

`retain_for_later` cancels the current event and creates replacement entitlement. It is not itself a billing decision.

### C. Service truth

- `scheduled_not_yet_serviced`
- `serviced`
- `not_serviced_student_cancelled`
- `not_serviced_teacher_cancelled`
- `not_serviced_school_cancelled`
- `not_serviced_no_show`

Do not add “partial” as a cancellation option. If the school later needs shortened or interrupted lesson reporting, model actual minutes separately from cancellation resolution.

### D. Original charge treatment

- `keep_full_charge`
- `waive_full_charge`
- `reduce_charge`
- `account_credit`
- `manual_financial_review`

`refund` is intentionally not a charge treatment. It is a collected-money action.

### E. Replacement service

- `none`
- `replacement_minutes`
- `reschedule_now`

Replacement attributes:

- minutes;
- beneficiary student;
- transferability within the billing account;
- teacher constraint and optional teacher;
- offering/instrument constraint;
- expiration timestamp and anchor;
- notes visible to staff or family;
- allocation/reservation history.

### F. Additional account adjustments

Zero or more actions:

- fee;
- courtesy credit;
- discount;
- manual charge;
- manual credit;
- reversal.

Each action stores signed amount, currency, category, description, status, target period when known, causation ID, reversal ID, actor, and timestamps.

### G. Collected-money remedy

- `none`
- `refund_requested`
- `refund_submitted`
- `refund_succeeded`
- `refund_failed`
- `manual_payment_review`

A refund must reference a succeeded payment attempt and cannot exceed the remaining refundable amount. Provider success, not an owner click, establishes `refund_succeeded`.

### H. Communications

The decision transaction creates durable communication intentions for the payer, assigned teacher, owner/admin audience, and any affected replacement teacher. Delivery state never determines business truth.

## Common outcome recipes

Recipes make policy setup understandable without restricting owner exceptions.

| Owner-facing recipe | Calendar | Service truth | Original charge | Replacement | Additional action |
| --- | --- | --- | --- | --- | --- |
| Leave lesson scheduled | Leave scheduled | Scheduled | Unchanged | None | None |
| Late cancellation; no replacement | Cancel | Not serviced—student cancelled | Keep full charge | None | Optional fee/credit |
| Courtesy cancellation | Cancel | Not serviced—student cancelled | Waive full charge | None | Optional credit |
| Reschedule later | Retain for later | Not serviced—student cancelled | Configurable | Replacement minutes | Optional fee |
| Move lesson now | Reschedule now | Original not serviced; replacement scheduled | Preserve agreement billing | Direct replacement | Optional fee |
| Teacher cancellation | Cancel or retain | Not serviced—teacher cancelled | Waive/review | Replacement or credit | Optional courtesy credit |
| No-show | Cancel/no-show | Not serviced—no-show | Keep/waive/review | Usually none | Optional fee |
| Refund paid lesson | Cancel | Not serviced | Record correction | Optional | Refund linked to payment |

These recipes are defaults. “Make an exception” exposes the relevant dimensions and requires an internal explanation when the result differs from policy.

## Combination rules

### Always allowed with an authorized owner and explanation

- Keep the original charge and grant replacement service.
- Waive the original charge and grant replacement service.
- Keep or waive the charge and also add a fee or courtesy credit.
- Transfer replacement service to another student on the same billing account.
- Remove, extend, or waive an entitlement through a compensating revision.

These may be unusual, but they reflect real human agreements and should produce warnings rather than arbitrary hard blocks.

### Require stronger confirmation or additional data

- Replacement plus full account credit or refund: warn about a potentially duplicated remedy.
- Any policy exception: require a reason.
- Any change after payer approval: require a new billing version/approval when the amount changes.
- Any settled-money remedy: require payment attribution and provider confirmation.
- Transfer: require both students to belong to the same active school billing account.
- Reschedule now: require conflict and authorization checks under lock.
- Expired entitlement restoration: require an owner reason and append a revision.

### Non-overridable system boundaries

- Cross-school or unauthorized access.
- Erasing published policy, submitted request, decision, payment, refund, communication, or audit evidence.
- Creating a refund beyond remaining collected funds.
- Marking a provider operation successful without signed provider truth.
- Double-consuming the same entitlement minutes.
- Applying one adjustment twice.
- Scheduling the same teacher/student into an unresolved hard conflict without a separate conflict-resolution action.

## Proposed relational shape

Names are provisional; the separation is the important contract.

### Policy defaults

`cancellation_policy_outcomes`

- policy version;
- scenario: student cancellation, reschedule request, no-show, teacher cancellation, school cancellation;
- timing bucket: timely, late, not applicable;
- calendar action;
- original charge treatment;
- replacement kind/minutes rule;
- teacher constraint;
- transferability;
- expiration duration and anchor;
- adjustment recipe and amount/formula;
- owner-review requirement;
- family guidance.

One uniform row shape replaces the current asymmetric timely/late/no-show/teacher fields.

### Decision revisions

`lesson_change_decision_revisions`

- request/case ID;
- revision number;
- supersedes revision ID;
- policy outcome snapshot;
- actual outcome snapshot;
- exception flag and internal reason;
- payer-facing summary snapshot;
- actor/role/source;
- decided timestamp;
- correlation and causation IDs.

Rows are append-only. A view identifies the current effective revision.

### Entitlement ledger

Keep `lesson_service_entitlements`, but add immutable entitlement events or allocations:

- granted minutes;
- reserved minutes linked to a proposed/scheduled lesson;
- consumed minutes linked to a serviced lesson;
- released minutes after cancellation;
- transferred minutes with from/to student;
- expired, restored, waived, or voided minutes;
- actor, reason, correlation, and causation.

Available balance is derived from ledger entries. Current status is derived or transactionally maintained as a cache.

### Financial action ledger

Replace the singular pending adjustment concept with append-only account actions that may later attach to a billing line, approval version, payment, or reversal. Keep specialized Stripe tables authoritative for provider truth.

### Calendar linkage

Every direct reschedule or entitlement allocation links original event, replacement event, request, decision revision, and event-change record.

## Payer-facing language contract

The payer sees only facts that affect them:

- whether the request was received, approved, declined, or still awaiting review;
- whether the original lesson remains scheduled or is cancelled;
- whether it will be counted as serviced for billing;
- whether another lesson is available, for whom, for how long, and with which teacher restriction;
- fee or account credit amount and when it will appear;
- refund amount and whether it is requested, processing, completed, or failed;
- the authoritative request and decision timestamps;
- what the payer should do next.

Examples:

> Your cancellation was approved. Under the school’s late-cancellation policy, Wednesday’s lesson will be counted as serviced and no replacement lesson was added.

> Your cancellation was approved. One 45-minute lesson is available for Joey to schedule through November 30. A $25 late-change fee will appear on the family’s next statement.

> The school made an exception and waived the late-cancellation fee. One 45-minute replacement lesson remains available.

> A $40 refund was requested. We will send another confirmation when the payment provider completes it.

Never tell the payer a refund completed merely because an owner selected it.

## Owner UX contract

The default view should be a recommended outcome card, not a large matrix.

1. Show request, lesson, student, teacher, weekday/date, recorded time, policy window, and financial state.
2. Show one plain-language policy recommendation.
3. Primary action: `Use policy recommendation`.
4. Secondary action: `Make an exception`.
5. Exception mode progressively reveals:
   - scheduled lesson;
   - replacement service;
   - financial result;
   - collected-money remedy when eligible;
   - internal reason and communication preview.
6. Show an exact final summary before hold-to-confirm.
7. After resolution, show the current outcome, history, and `Correct this decision` action.

Avoid a single dropdown whose values secretly change multiple domains.

## Security and transaction boundary

The final RPC must:

1. authenticate the actor and independently verify active owner/admin membership;
2. rate-limit the consequential action;
3. lock request, lesson, applicable decision revision, entitlement allocations, billing period/line, and payment/refund records in deterministic order;
4. re-evaluate stale request, calendar, financial, policy, and provider state;
5. validate all IDs belong to the same school and billing account;
6. validate currency, amount, refundable balance, entitlement balance, and schedule conflicts;
7. apply every local business transition atomically;
8. enqueue communications transactionally;
9. append domain and audit events;
10. return a structured result with correlation ID and explicit reconciliation state.

Stripe submission occurs after the local refund intention is committed, using stable idempotency. Provider acceptance followed by local finalization failure becomes reconciliation-required, never an ordinary safe retry.

## Migration plan

### Phase 1 — Vocabulary and compatibility

- Introduce orthogonal outcome enums/constraints and compatibility views.
- Rename internal `count_as_serviced` semantics to `not_serviced + keep_full_charge` without rewriting historical evidence.
- Keep current UI operational through an adapter translating old recipes to the new model.
- Add currency and explicit policy-applicability snapshots.

### Phase 2 — Revisionable decisions

- Add append-only decision revisions and current-decision view.
- Migrate each existing decision to revision 1.
- Implement atomic correction/supersession with compensating actions.
- Preserve old decision IDs as causation references.

### Phase 3 — Entitlement allocation ledger

- Add reservation, consumption, release, transfer, expiration, restoration, waiver, and void events.
- Link scheduled/replacement lesson events.
- Backfill current entitlements as granted balances.
- Prevent double consumption with database constraints and locked balance checks.

### Phase 4 — Unified financial actions

- Add multi-action, currency-aware account adjustments and reversals.
- Consume actions idempotently into editable billing versions.
- Force reapproval when an already-presented amount changes.
- Keep fixed-monthly and per-session behavior explicit.

### Phase 5 — Refund orchestration

- Add line/payment attribution required for eligible refunds.
- Create refund intentions and Stripe idempotency/reconciliation flow.
- Separate requested/submitted/succeeded/failed messaging.

### Phase 6 — Policy editor and owner UI

- Replace coupled fields with simple outcome recipes plus advanced settings.
- Replace the three-option dropdown with recommendation/exception sections.
- Surface current outcome and correction history on request, lesson, student, family, teacher, and approval records.

## Acceptance matrix

At minimum, automated and live rehearsals must cover:

- timely cancellation: waive/no replacement;
- late cancellation: keep charge/no replacement;
- late cancellation: keep or waive charge + replacement + fee;
- owner exception with required reason;
- direct reschedule and retain-for-later;
- same-family entitlement transfer;
- entitlement reserve, consume, release, expire, restore, and concurrent double-consume attempt;
- no-show and teacher-cancellation remedies;
- draft, locked, approved, paid, partially refunded, and non-refundable financial states;
- fee plus courtesy credit;
- fixed-monthly and per-session billing;
- amount change requiring payer reapproval;
- refund provider success, failure, timeout, duplicate webhook, and reconciliation-required;
- decision corrected while another browser has the old modal open;
- duplicate submission and stale request;
- email accepted/rejected/reconciled independently of business success;
- owner/admin authorization, teacher denial, payer denial, cross-school IDs, and direct RPC attempts;
- DST boundaries and exact policy cutoff timestamp;
- historical policy version remains reproducible after later publication.

## Implementation gate

Do not expand the current owner resolution dropdown or build elaborate styling on top of it. The next schema implementation should complete Phases 1 and 2 together so new decisions are semantically correct and revisionable. Entitlement and financial-ledger phases may follow behind compatibility adapters, but the UI must not offer a remedy until its durable lifecycle and correction path exist.
