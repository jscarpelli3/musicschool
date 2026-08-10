# Production Domain Cutover

This is the canonical checklist for replacing the temporary Vercel address with the real MusicSchool application origin.

## Values To Record

- Temporary origin: `https://musicschool-alpha.vercel.app`
- Production origin: `https://<real-app-domain>`
- Production hostname: `<real-app-domain>`
- Cutover date:
- Operator:
- Rollback decision deadline:

Use an origin only: scheme plus hostname, with no path and no trailing slash. Prefer a stable application subdomain such as `https://app.example.com` so the marketing website can change independently.

## URL Inventory

### Vercel

- Add the production hostname under Project → Settings → Domains.
- Add the Vercel DNS records at the domain registrar and wait for Vercel to show the domain as valid.
- Change `APP_URL` in the **Production** environment from the temporary origin to the production origin.
- Review Preview and Development separately; do not overwrite them accidentally.
- Redeploy after changing `APP_URL`. Environment changes do not alter an already-built deployment.
- Keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, Stripe keys, and Twilio credentials unchanged unless a provider/project is also being replaced.

`APP_URL` currently controls:

- Stripe Connect onboarding return and refresh URLs.
- Stripe-hosted payer card-setup success/cancel URLs.
- Billing approval links sent by SMS.
- Twilio delivery-status callback URLs attached to outbound messages.
- Exact public URLs used for Twilio webhook-signature validation.

### Twilio Messaging Service

Change all three integrations to the production origin and keep HTTP `POST`:

- Incoming message URL: `https://<real-app-domain>/api/twilio/incoming`
- Fallback URL: `https://<real-app-domain>/api/twilio/incoming/fallback`
- Delivery Status Callback: `https://<real-app-domain>/api/twilio/status`

Also review and update every public URL supplied during toll-free verification:

- Opt-in form: `https://<real-app-domain>/sms-consent`
- Privacy policy: `https://<real-app-domain>/privacy`
- Terms: `https://<real-app-domain>/terms`
- Support/help: `https://<real-app-domain>/support`

If Twilio does not permit editing an approved or pending toll-free submission, open a support request before retiring the temporary domain. Do not delete the temporary Vercel alias while Twilio may still review or visit those URLs.

No Twilio SID, auth token, API key, Messaging Service SID, or phone number changes merely because the app domain changes.

### Stripe

Review each webhook destination in both test and live mode. The current application endpoint is:

- `https://<real-app-domain>/api/stripe/webhooks`

There may be separate destinations for platform/Accounts events and connected-account payment events even when they share the same URL. Inventory each destination and its event scope before changing anything.

After editing or replacing a destination:

- Send a test/ping event and require HTTP 200.
- Confirm whether Stripe retained or rotated that destination's signing secret.
- If it changed, update the matching Vercel Production variable and redeploy:
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PLATFORM_WEBHOOK_SECRET`
  - `STRIPE_PAYMENTS_WEBHOOK_SECRET`
- Keep the old destination active until the new destination returns 200 and a real test event appears once in `payment_provider_events`.
- Disable the old destination only after checking that no event deliveries remain pending.

The Stripe API keys, connected-account IDs, customers, saved payment-method references, and Connect accounts do not change with the app domain.

### Supabase Authentication

In Authentication → URL Configuration:

- Change **Site URL** to the production origin.
- Add the production callback to **Redirect URLs**:
  - `https://<real-app-domain>/auth/callback`
- Temporarily retain the local and Vercel callbacks during testing:
  - `http://localhost:3001/auth/callback`
  - `https://musicschool-alpha.vercel.app/auth/callback`
- Remove the temporary Vercel callback only after production login, logout, onboarding, and protected-route return behavior pass.

The Supabase project URL and JWKS URL remain unchanged:

- `NEXT_PUBLIC_SUPABASE_URL`
- `https://<supabase-project-ref>.supabase.co/auth/v1/.well-known/jwks.json`

### Google Cloud OAuth

The Google OAuth **Authorized redirect URI** normally remains the Supabase callback, not the app callback:

- `https://twhexxokrjwzsoxgzlme.supabase.co/auth/v1/callback`

Do not replace that URI merely because the application domain changed.

Review the OAuth web client and consent/branding configuration for references to the temporary domain:

- Add `https://<real-app-domain>` to Authorized JavaScript origins if origins are configured.
- Replace temporary home page, privacy policy, terms, and authorized-domain entries with the real domain where applicable.
- Keep the Supabase redirect URI.
- Reverify the OAuth consent screen/domain if Google requests it.

No Google client ID or client secret rotation is required solely for a domain change.

### GitHub And Vercel Git Integration

- No repository remote or GitHub Actions change is expected for a domain-only cutover.
- Review repository environments, secrets, badges, README links, and deployment-protection rules for hardcoded temporary URLs.
- Confirm the Vercel production branch remains `main`.

### Public And Operational References

Search before cutover:

```bash
rg -n "musicschool-alpha\.vercel\.app|APP_URL|localhost:3001" . \
  --glob '!node_modules/**' --glob '!.git/**'
```

Update any occurrences in:

- Documentation and operational runbooks.
- Twilio registration evidence or screenshots.
- Support scripts, bookmarks, QR codes, consent links, and payer-facing templates.
- Password-manager notes and provider account descriptions.
- Monitoring checks, uptime probes, error-reporting allowed origins, and analytics configuration when those services are added.
- Future transactional-email links, sending-domain records, and email-provider webhook URLs.

## Safe Cutover Order

1. Add and verify the custom domain in Vercel without removing the temporary alias.
2. Verify HTTPS, `/login`, `/sms-consent`, `/privacy`, `/terms`, and `/support` on the custom domain.
3. Add the custom callback/origin to Supabase and Google while retaining the old entries.
4. Inventory every Stripe destination and record its current signing-secret variable before making changes.
5. Prepare a short coordinated window for `APP_URL` and Twilio because Twilio signatures depend on the exact URL.
6. Change Vercel Production `APP_URL` to the custom origin and redeploy.
7. Immediately change the three Twilio Messaging Service URLs to the custom origin.
8. Change or add Stripe webhook destinations, verify HTTP 200, and update signing-secret variables if Stripe rotates them.
9. Test Google login, logout, Connect onboarding return, payer card-setup return, approval-link generation, Twilio invalid-signature rejection, and Stripe/Twilio provider callbacks.
10. Observe production logs and provider delivery logs through at least one complete test flow.
11. Leave the temporary Vercel alias and provider allowlist entries in place for a rollback window.
12. Remove old callbacks and destinations only after the rollback window closes and no traffic still reaches them.

## Required Acceptance Tests

- The custom domain has a valid certificate and no redirect loop.
- Google login returns to the custom domain and preserves the intended `next` path.
- A signed-in owner can open the correct school and family account.
- Stripe Connect onboarding returns to the custom payment page.
- Stripe-hosted card setup returns to the correct family page.
- Each Stripe webhook destination returns 200 and records one provider event without duplication.
- A generated approval URL uses the custom domain.
- Twilio incoming, fallback, and delivery callbacks reject an invalid signature with 400.
- A signed Twilio test callback returns 200.
- STOP blocks outbound SMS; START/UNSTOP restores it; HELP does not change consent.
- Consent, privacy, terms, and support pages return 200 at the URLs registered with Twilio.
- No new application or provider errors appear during the observation window.

## Rollback

- Keep the temporary Vercel alias attached until acceptance tests pass.
- Restore the previous `APP_URL`, redeploy, and restore Twilio callback URLs together; changing only one side breaks signature validation.
- Re-enable the prior Stripe destinations if the new endpoints fail, but never run two active destinations long enough to ignore duplicate-event monitoring.
- Keep both Supabase redirect URLs during rollback. Revert the Site URL only if authentication return behavior requires it.
- Record the failure, provider response, and final active URL in the payment audit log before attempting another cutover.
