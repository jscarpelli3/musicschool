# Staging Environment

The persistent staging environment exists to test migrations, authentication, provider callbacks, and payment behavior without touching production data or live money.

## Environment mapping

| Layer | Staging target |
| --- | --- |
| Git | Protected `staging` branch |
| Supabase | Persistent branch project `plnluybazyltxtsbkxpn` |
| Database data | Empty by default; synthetic fixtures only |
| Stripe | Test mode only, with a staging-specific webhook destination and signing secret |
| Vercel | Branch-scoped `staging` preview/environment; never generic production credentials; Vercel Authentication remains enabled |
| Email/SMS | Email allowlisted to named test recipients; SMS non-delivering unless separately approved |

## Non-negotiable boundaries

- Never copy production Auth users, family records, Storage objects, tokens, or payment data into staging.
- Never configure a Stripe live-mode secret, live connected account, or production webhook secret in staging.
- Never reuse production Supabase server keys or provider webhook secrets in staging.
- Keep `APP_URL` pointed at the stable staging application origin so callback and Checkout return URLs cannot cross environments.
- Use obvious synthetic identities and test-domain addresses. External delivery must be disabled or restricted to an explicit allowlist.
- A successful Supabase branch deployment does not prove the Vercel preview is isolated. Verify its environment-variable scopes before opening or sharing the application URL.
- Treat a Vercel automation-bypass value and every URL containing it as a secret. Never commit, paste into tickets or chat, or include it in screenshots.

## Current state — 2026-09-19

- Supabase successfully mapped its persistent staging project to Git `staging` and applied the repository migrations.
- The Git `staging` branch and `main` require pull requests, current `verify` and `database` checks, resolved conversations, and linear history.
- All Git branches reject deletion and force pushes.
- Staging database seeding is disabled until a deterministic synthetic fixture is reviewed and committed.
- Vercel production variables are now scoped only to Production. Separate staging values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `APP_URL` are scoped to Preview branch `staging`. The Supabase project reference is verified; a fresh deployment after the `APP_URL` change remains required before callback testing.
- A dedicated Stripe sandbox named `Common Time Staging` exists. Previous Stripe variables are scoped only to Vercel Production; staging Stripe keys and webhook secrets must be scoped only to Preview branch `staging`.
- The persistent staging branch owns its Auth Site URL and exact OAuth callback in `supabase/config.toml` under `[remotes.staging.auth]`. Change those values in Git rather than only in the dashboard; otherwise a later branch deployment can restore the local-development redirect.
- The first staging Stripe Connect attempt on 2026-09-24 reached Stripe and created one idempotently keyed test account, then exposed missing explicit `service_role` grants on the branch database. Migration `20260924160000_grant_stripe_connection_sync.sql` defines and verifies the narrow connection-sync and append-only audit privileges; the existing account is reused on retry.
- **Before inviting beta testers:** update the Stripe platform branding from the personal fallback name `Jonathan Scarpelli` to `Common Time`, and add the approved Common Time icon, logo, and brand color. The current Stripe-hosted onboarding copy says “Jonathan Scarpelli uses Stripe for secure payments” and “Return to Jonathan Scarpelli.” Make this change in the platform's Connect branding settings when leaving the sandbox; Stripe's legal and verification copy remains provider-controlled.

## Staging email gate

Staging email delivery is fail-closed in application code. Configure all three values only for Vercel Preview branch `staging`:

- `RESEND_API_KEY`: a send-only Resend key suitable for the staging rehearsal.
- `EMAIL_DELIVERY_MODE=allowlist`
- `EMAIL_ALLOWED_RECIPIENTS`: comma-separated exact owner, teacher, and payer test addresses.

Allowlist mode is rejected in Vercel Production. In staging it permits links to the configured `APP_URL` but refuses every recipient not named in `EMAIL_ALLOWED_RECIPIENTS`. Redeploy after changing the list. Use controlled addresses only; do not add an invented or unconfirmed address.

## Protected webhook access

Vercel Authentication protects the staging preview, so Stripe cannot call the webhook without an explicit protection bypass. Use a dedicated **Protection Bypass for Automation** secret named `Stripe Staging Webhooks`; do not disable protection for the whole staging application.

Stripe destinations that cannot send Vercel's custom header use this HTTPS endpoint form:

```text
https://musicschool-git-staging-music-school.vercel.app/api/stripe/webhooks?x-vercel-protection-bypass=REDACTED
```

This is a deliberate, bounded tradeoff:

- HTTPS protects the full URL in transit, but the URL can still appear in Stripe configuration, Vercel access logs, monitoring, browser history, screenshots, or support exports.
- The bypass authenticates the request only to Vercel. The application must still reject any payload without a valid Stripe signature from a configured staging `whsec_...` secret.
- The bypass can unlock other protected deployments in the Vercel project. Restrict access to the Stripe destination and Vercel project, and never reuse the value for another provider.
- Use synthetic staging data only. The bypass never justifies placing production data or live Stripe credentials in staging.

### Rotation checklist

The owner of a staging payment test must rotate the dedicated bypass secret:

- immediately if the token or complete webhook URL is pasted, logged somewhere unexpected, screenshotted, or otherwise suspected exposed;
- when a person who could view it loses access;
- after the beta/payment-test exercise ends; and
- at least every 90 days while the destination remains active.

To rotate it safely:

1. Generate a new dedicated Vercel automation-bypass secret.
2. Replace the query-parameter value in every `Common Time Staging` Stripe event destination.
3. Send a Stripe test/ping event to each destination and require HTTP `200` plus one expected durable `payment_provider_events` record.
4. Revoke the old Vercel bypass secret only after every destination passes.
5. Redeploy staging if Vercel indicates that the managed `VERCEL_AUTOMATION_BYPASS_SECRET` value requires a new deployment.
6. Record the rotation date, operator, destination inventory, non-secret delivery evidence, and the next due date below. Never record either secret value.

| Rotated (UTC) | Operator | Destination evidence | Next due | Status |
| --- | --- | --- | --- | --- |
| Pending initial configuration | — | — | — | Open |

## Next configuration gate

The Supabase variables and application origin are configured. Complete the remaining staging-only provider settings:

- `STRIPE_MODE=test`
- staging-specific Stripe secret and webhook signing secrets

After configuration, redeploy `staging` and verify server-side that its Supabase project reference is `plnluybazyltxtsbkxpn` before creating any test users or payment fixtures.
