# Data Recovery And Backup Requirements

This document defines the minimum recovery posture before MusicSchool handles real school, family, consent, or payment data.

## Current development state

- Supabase is the system of record for application data.
- Supabase Storage holds profile avatars and school logos; future school documents will also live there.
- GitHub is the remote source-code checkpoint.
- Stripe will be the system of record for card credentials and provider payment objects.
- The current project must be treated as development until the production checklist below is complete.

## Production minimum

1. Upgrade the production Supabase organization to Pro before entering live customer data.
2. Confirm daily database backups are visible and establish who is authorized to restore them.
3. Retain at least one periodic logical database export outside the Supabase project so project deletion does not delete every recovery copy.
4. Export or replicate Storage objects separately. Database backups contain Storage metadata, not the underlying files.
5. Keep migrations, generated types, and application code committed and pushed to GitHub.
6. Store Stripe and webhook secrets only in local/Vercel secret environments; maintain a documented rotation procedure.
7. Store every accepted Stripe event ID in Postgres so provider state can be replayed and reconciled after an outage.
8. Test restoration into a non-production project before launch and at a regular interval afterward.

## Initial recovery targets

- Database recovery point objective: no more than 24 hours using Pro daily backups during the first-school stage.
- Payment recovery point objective: zero acknowledged provider events lost; reconcile against Stripe using stored object/event references.
- Source recovery point objective: every completed roadmap step committed and pushed before the next step begins.
- Storage recovery point objective: no more than 24 hours once family or legal documents are accepted.

Point-in-time database recovery can reduce the database window to seconds, but its current cost is disproportionate for the first school. Re-evaluate it when transaction volume or contractual obligations make a 24-hour database recovery point unacceptable.

## Restore rehearsal

1. Select a known backup/export and restore it into an isolated non-production project.
2. Run migration-history comparison and schema/type generation.
3. Verify tenant membership, people, lessons, policies, billing snapshots, approvals, and payment ledger counts.
4. Verify Storage metadata against the separately restored object inventory.
5. Reconcile sampled payment attempts against Stripe test objects and stored webhook events.
6. Record elapsed time, missing dependencies, failures, and the actual recovery point.
7. Remove the isolated rehearsal project only after results are documented and approved.

## Destructive-operation rule

No production project deletion, restore, bulk delete, or irreversible billing mutation is performed without a resolved target, a current recovery point, and explicit owner authorization.
