# Cancellation Rules Matrix

This document visualizes how Common Time should resolve family cancellation and reschedule actions while preserving owner discretion.

> [!IMPORTANT]
> Policy recommends the normal result. The owner remains able to make a documented exception or correction. Security boundaries, tenant separation, provider truth, and preservation of historical evidence cannot be overridden.

## Implementation legend

| Status | Meaning |
| --- | --- |
| **Live** | Implemented in the deployed database and application |
| **Foundation live** | Data model and security boundary exist, but the consequential transaction is not enabled |
| **Planned** | Agreed behavior that still requires implementation and testing |

## Current test path

### School settings

Open [Common Time cancellation policies](https://app.commontime.studio/schools/74d60cb7-1217-4fef-bb74-2c659a83722b/policies).

Under **Family cancellation access**, select:

- Timely cancellations: **Owner review required**
- Refunds: **Tell families refunds are handled directly**

Press **Save family access**.

Expected behavior:

- The button displays a saving state.
- A confirmation toast appears.
- Reloading preserves the selections.
- Automatic approval and portal refund requests remain disabled until their complete transactions are active.

### Existing owner request

Open [Amelia Davis’s September 3 request](https://app.commontime.studio/schools/74d60cb7-1217-4fef-bb74-2c659a83722b/approvals?request=efb97c14-47a1-4a9b-9191-ffe0395c8921).

Choose:

- **Cancel without counting it as serviced**
- **No additional adjustment**
- Hold to apply the decision

### Family portal

Open the [Family Portal](https://app.commontime.studio/portal), then open Amelia’s Thursday, September 10 lesson.

Expected behavior:

- The policy result appears automatically.
- There is no preliminary **Request cancellation** button.
- Available actions are displayed immediately.
- Choosing an action opens a confirmation modal.
- Closing the modal submits nothing.
- Holding the confirmation records the request.

## Family action matrix

| Timing and authority | Reschedule | Cancel without rescheduling | Refund |
| --- | --- | --- | --- |
| Within window; owner review required | Submit a reschedule request. Lesson remains scheduled until approved. | Submit an account-credit or cancellation request. Lesson remains scheduled until approved. | Display according to the effective refund mode. A refund always requires owner review. |
| Within window; automatic approval | Cancel the occurrence and return its service value to the unscheduled lesson pool. | Cancel the occurrence and create the appropriate account credit. | Create a refund request only. Never move money automatically. |
| Outside window | Submit for owner review under the published late-change policy. | Submit for owner review under the published late-change policy. | Display only when permitted; always require owner review. |
| No applicable published policy | Block self-service and explain that the school must configure its policy. | Block self-service and explain that the school must configure its policy. | Do not offer a refund action. |

### Current implementation status

| Capability | Status |
| --- | --- |
| Immediate server-authoritative policy preview | **Live** |
| Owner-reviewed cancellation and reschedule requests | **Live** |
| Single hold-to-confirm submission modal | **Live** |
| School timely-approval setting | **Foundation live** |
| School refund-presentation setting | **Foundation live** |
| Effective-dated payer overrides with private reasons | **Foundation live** |
| Automatically apply eligible cancellations | **Planned** |
| Portal refund request and owner resolution lifecycle | **Planned** |
| Payer-override owner UI | **Planned** |

## Refund mode matrix

| Effective refund mode | Family portal behavior | Owner behavior |
| --- | --- | --- |
| `allow_request` | Show **Cancel and request a refund** when the lesson has collected funds that may be refundable. | Review the request, identify refundable payment allocations, and deliberately initiate or decline the refund. |
| `contact_school` | Display: **Refunds are handled directly by the school.** | Handle the conversation outside the portal and record any resulting decision manually. |
| `not_offered` | Explain that lesson payments are nonrefundable. Do not show a refund action. | The owner may still make a documented exceptional decision when legally and technically possible. |

> [!NOTE]
> A refund returns collected money. An account credit reduces a current or future balance. They are not interchangeable internally, even when the family-facing explanation remains simple.

## Payer override matrix

An active payer override may change only the family-access behavior. It does not rewrite the published policy or historical decisions.

| Setting | Available override values |
| --- | --- |
| Timely approval | Use school default, require owner review, or automatically approve |
| Refund presentation | Use school default, allow requests, require direct contact, or do not offer refunds |
| Private reason | Required; visible only to authorized owners and admins |
| Effective period | Starts immediately or at a recorded time; may have an expiration |

Examples of possible private reasons include a special written agreement, repeated payment failures, chronic late payment, or an individually negotiated accommodation. The family sees the resulting rules, not the private reason.

## Resolution precedence

The system resolves rules in this order:

| Priority | Source | Can it be overridden? |
| ---: | --- | --- |
| 1 | Security, tenant scope, authenticated identity, payment truth, and provider feasibility | No |
| 2 | Published policy version applicable to the lesson | Only by a documented owner decision; historical snapshot remains |
| 3 | Current school family-cancellation settings | Yes, by an active payer override |
| 4 | Active payer-specific override | Yes, by a later append-only override or individual owner decision |
| 5 | Individual owner decision or correction | Yes, by a later documented revision or compensating action |

## Payer language and internal meaning

| Family-facing choice | Internal meaning |
| --- | --- |
| **Reschedule this lesson** | Cancel the scheduled occurrence and retain equivalent service in the unscheduled lesson pool. |
| **Cancel and request account credit** | Cancel the occurrence and request a monetary credit against the billing account rather than retaining service. |
| **Cancel and request a refund** | Cancel the occurrence and request return of previously collected money. No refund occurs until separately approved and executed. |
| **Cancel this lesson** | Cancel an unaccounted lesson without creating retained service, an account credit, or a refund unless the owner decides otherwise. |

## Automatic cancellation transaction

When automatic approval is enabled and the action is eligible, one atomic database transaction must:

1. Revalidate the authenticated payer’s access to the billing account and lesson.
2. Recompute the policy window and effective access settings at submission time.
3. Lock the lesson and reject stale, duplicate, or conflicting submissions.
4. Record the family action and frozen policy/access snapshots.
5. Record a truthful system-policy decision actor—not a fictional owner approval.
6. Cancel the scheduled occurrence while preserving `not serviced` as service truth.
7. Create either retained lesson service or an account credit, according to the selected action.
8. Append domain and audit events with one correlation identifier.
9. Queue durable family, owner, and teacher notifications.
10. Return a timestamped receipt independent of email-delivery success.

Email delivery failure must never roll back or erase the accepted cancellation.

## Non-negotiable invariants

1. A cancelled lesson that did not occur is never stored internally as serviced.
2. Automatic approval never means automatic refunding.
3. The original lesson remains linked to every request, decision, entitlement, credit, fee, and refund.
4. Policies and access settings are snapshotted when an action is submitted.
5. Corrections append revisions or compensating actions; they do not erase history.
6. Owners retain human discretion, but cannot bypass authorization, tenant isolation, provider truth, or audit evidence.
7. UI visibility is not a security boundary. Server validation and database authorization independently enforce every consequential action.
