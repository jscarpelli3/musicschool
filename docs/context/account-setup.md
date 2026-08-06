# Account And Provider Setup

## Create Now

### 1. GitHub

- Use an existing account or create one.
- Create a private repository for this project.
- Connect the repository to Vercel after the Next.js app is scaffolded.
- Keep production secrets in provider dashboards, never in Git.

### 2. Vercel

- The existing personal Hobby account is enough for local development, previewing a non-commercial prototype, and learning the deployment flow.
- Before the app is used commercially by the music school or sold to other schools, upgrade the production team to Vercel Pro. Vercel restricts Hobby to personal, non-commercial use.
- Later, create separate preview/staging and production environment-variable values.

### 3. Supabase

- Create a Supabase account and an organization for the product.
- Start with one development project on the Free plan.
- A second free project can be used for staging while the account remains within Supabase's two-active-free-project limit.
- Create a production project when launch approaches; use a paid production plan so it is not paused for inactivity and has managed backups.
- Enable Google as an Auth provider after the Google OAuth client is created.

### 4. Google Cloud

- Use an existing Google account or create a dedicated business-owned account.
- Create a Google Cloud project for the application.
- Configure the Google Auth consent/branding screen.
- Create an OAuth 2.0 Web Application client.
- Add local, preview, and production callback URLs as they become available.
- For v1, request basic identity scopes only. Do not request Gmail, Calendar, or Drive access unless a feature requires it.
- Use `https://twhexxokrjwzsoxgzlme.supabase.co/auth/v1/callback` as the Google OAuth authorized redirect URI.
- Enable Google under Supabase Authentication providers after creating the client, entering the client ID and client secret directly in Supabase.
- Store the project's current `sb_secret_` key as server-only `SUPABASE_SECRET_KEY` when trusted provider callbacks and webhooks are introduced. Never expose it with a `NEXT_PUBLIC_` prefix.

### 5. Stripe

- Create a Stripe account owned by the software business, not by an individual developer account that cannot later be transferred cleanly.
- Use Stripe test mode while building.
- Configure the account as a Connect SaaS platform and use Stripe-hosted onboarding for schools.
- Use direct payments on connected school accounts so schools remain merchants of record and receive funds directly.
- Add the legal business, bank, tax, and identity information required to activate live payments before launch.
- Create subscription products/prices later, after packaging is decided.
- Configure a webhook endpoint separately for preview/testing and production.
- Connect configuration selected on 2026-08-05: sellers collect payments directly and use Stripe-hosted onboarding with the full Stripe Dashboard. Accounts v2 is used so Stripe remains responsible for fees, requirements, and unrecoverable connected-account losses; Express Dashboard is incompatible with that responsibility allocation.
- Store `STRIPE_MODE=test` and the test secret key as server-only environment variables locally and in the appropriate Vercel environment. Never send the key through chat or prefix it with `NEXT_PUBLIC_`.

## Create Before Public Email

### 7. Domain And DNS

- Register a product domain, or choose a subdomain of a domain already controlled by the business.
- Ensure the business controls DNS so Vercel, transactional email, and Google OAuth records can be configured.
- Prefer role-based ownership addresses such as `admin@`, `billing@`, and `support@` rather than tying services only to one person's mailbox.

### 8. Transactional Email

- Create a Resend account when invitations, schedule changes, and reminders are implemented.
- Verify a sending subdomain through DNS, for example `notifications.example.com`.
- Keep authentication email configuration and operational email templates deliberately separated.

## Defer Until The Feature Is Scheduled

### 9. Twilio

- Do not create or fund this account merely to scaffold v1.
- Create it when SMS reminders enter the build plan.
- Purchase a number, create a Messaging Service, design consent and opt-out handling, and complete the applicable U.S. A2P 10DLC registration before sending production messages.
- If this becomes a platform used by many schools, determine the ISV/subaccount and per-school registration approach before onboarding customers to SMS.

### 10. Monitoring

- Add an error-monitoring provider such as Sentry before production launch.
- Vercel and Supabase logs are sufficient during early scaffolding, but they are not a complete production alerting strategy.

## Ownership And Security Rules

- Prefer business-owned accounts and a business-controlled password manager.
- Enable multifactor authentication on GitHub, Vercel, Supabase, Google Cloud, Stripe, domain/DNS, email, and Twilio.
- Add at least one recovery administrator where the provider supports it.
- Never reuse the Agency Brain project's credentials or OAuth clients.
- Maintain separate local/development, staging, and production secrets.
- Never expose Supabase service-role, Stripe secret, webhook-signing, or OAuth client-secret values to the browser.

## Recommended Creation Order

1. GitHub repository
2. Supabase development project
3. Google Cloud project and OAuth client
4. Vercel project connected to GitHub
5. Product domain and DNS
6. Stripe test account and Connect platform configuration
7. Resend when invitations/email are implemented
8. Paid Vercel and production Supabase when commercial launch is near
9. Twilio and monitoring before their production features launch
