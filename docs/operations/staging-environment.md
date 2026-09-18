# Staging Environment

The persistent staging environment exists to test migrations, authentication, provider callbacks, and payment behavior without touching production data or live money.

## Environment mapping

| Layer | Staging target |
| --- | --- |
| Git | Protected `staging` branch |
| Supabase | Persistent branch project `plnluybazyltxtsbkxpn` |
| Database data | Empty by default; synthetic fixtures only |
| Stripe | Test mode only, with a staging-specific webhook destination and signing secret |
| Vercel | Branch-scoped `staging` preview/environment; never generic production credentials |
| Email/SMS | Non-delivering sandbox or allowlisted test recipients only |

## Non-negotiable boundaries

- Never copy production Auth users, family records, Storage objects, tokens, or payment data into staging.
- Never configure a Stripe live-mode secret, live connected account, or production webhook secret in staging.
- Never reuse production Supabase server keys or provider webhook secrets in staging.
- Keep `APP_URL` pointed at the stable staging application origin so callback and Checkout return URLs cannot cross environments.
- Use obvious synthetic identities and test-domain addresses. External delivery must be disabled or restricted to an explicit allowlist.
- A successful Supabase branch deployment does not prove the Vercel preview is isolated. Verify its environment-variable scopes before opening or sharing the application URL.

## Current state — 2026-09-18

- Supabase successfully mapped its persistent staging project to Git `staging` and applied the repository migrations.
- The Git `staging` branch and `main` require pull requests, current `verify` and `database` checks, resolved conversations, and linear history.
- All Git branches reject deletion and force pushes.
- Staging database seeding is disabled until a deterministic synthetic fixture is reviewed and committed.
- Vercel created a preview deployment before branch-specific Supabase values were confirmed. Treat that deployment as unsafe and do not test it yet.

## Next configuration gate

Configure a dedicated Vercel staging environment, or branch-scoped Preview variables for `staging`, with values from the Supabase staging branch:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `APP_URL`
- `STRIPE_MODE=test`
- staging-specific Stripe secret and webhook signing secrets

After configuration, redeploy `staging` and verify server-side that its Supabase project reference is `plnluybazyltxtsbkxpn` before creating any test users or payment fixtures.
