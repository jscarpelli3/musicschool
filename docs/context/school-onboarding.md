# School onboarding

## Purpose

The private beta onboarding path is designed for a school owner arriving without product vocabulary or prior training. It begins with a platform-issued link and ends at the owner workspace only after the school has one coherent student-and-payer relationship.

## Flow

1. A platform administrator creates a 14-day, email-bound link in `/admin`. Reissuing a link revokes the prior active link in the same transaction. Only a SHA-256 token digest is stored, and issuance creates a platform audit event containing an email digest rather than the raw address.
2. `/join/[token]` shows the invited address, sends a one-time code, and permits Auth user creation only after the invitation is validated. Ordinary account and family login continue to prohibit self-signup.
3. `/setup` claims the unexpired invitation transactionally and creates the school plus owner membership. Refresh/retry returns the existing active school instead of creating another tenant.
4. `/schools/[schoolId]/onboarding` is centered, resumable, and derives progress from durable school, student, teacher, branding, and instrument records. It covers school logo, owner avatar, first student and payer, instrument catalog, additional teacher invitations, and plain-language billing orientation.
5. First-family creation is one database transaction: student person, student role, payer identity/person, primary billing contact, family billing account, and student-account link either all succeed or none do.
6. Finishing requires at least one student and records `schools.onboarding_completed_at`. Logo, avatar, instruments, and additional teachers may be completed later from their normal settings.

## Language and accessibility

- Copy addresses the reader as an outside school owner and avoids internal state names.
- Financial words that may be unfamiliar use a focusable, hoverable `Term` explanation. Tooltips are available to keyboard users through `focus-within`, not hover alone.
- Approval is explicitly described as permission rather than payment. Statements, advance notice, saved payment methods, charge attempts, invoices, credits, and receipts remain separate concepts.
- One-time codes are explained as short, single-use passwords; the user is not expected to understand OTP terminology.

## Security and operations

- Invitation issuance and first-family creation have durable action limits in addition to origin, authentication, capability, RPC, RLS, and validation boundaries.
- Invitation history is retained; only one active invitation per normalized email is allowed.
- The payer Auth identity is provisioned before the atomic family transaction and must match the normalized email at the database boundary.
- Synthetic linked rehearsals on 2026-09-12 passed atomic invitation issuance, digest-only token storage, privacy-safe platform audit evidence, invited-identity school claim, duplicate claim idempotency, the complete student/payer/contact/account graph, completion gating, and targeted cleanup.
- Before inviting the beta tester, publish the matching application commit, create their link from `/admin`, and verify the production `/join/[token]` page without using another project's shared development browser session.
