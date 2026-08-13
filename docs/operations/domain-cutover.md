# Production Domain Cutover

This is the canonical checklist for replacing the temporary Vercel address with the real MusicSchool application origin.

## Values To Record

- Temporary origin: `https://musicschool-alpha.vercel.app`
- Owned domain: `commontime.studio`
- Canonical production application origin: `https://app.commontime.studio`
- Public marketing origin: `https://www.commontime.studio`
- Transactional email sending domain: `notifications.commontime.studio`
- Cutover date:
- Operator:
- Rollback decision deadline:

Use an origin only: scheme plus hostname, with no path and no trailing slash. `APP_URL`, approval links, authentication returns, and provider callbacks use `https://app.commontime.studio`. Public marketing, pricing, and product content use `https://www.commontime.studio`. Resend authenticates `notifications.commontime.studio`; it is not a browsable application hostname.

The application now enforces the hostname split: the apex permanently redirects to `https://www.commontime.studio`; `www` serves only the public Coming Soon page; all other hostnames receive an `X-Robots-Tag: noindex, nofollow, noarchive` response header. Both `www` and `app` must be attached to the Vercel project before relying on this behavior.

## URL Inventory

### Vercel

- Add `app.commontime.studio` under the application Project → Settings → Domains.
- Keep the already connected `commontime.studio` hostname active; it redirects to `www.commontime.studio`.
- Add `www.commontime.studio` to the current application project for the hostname-aware Coming Soon page. A future dedicated marketing project can replace that assignment without changing the application origin.
- Add the Vercel DNS records at the domain registrar and wait for Vercel to show the domain as valid.
- Change `APP_URL` in the **Production** environment from the temporary origin to `https://app.commontime.studio`.
- Review Preview and Development separately; do not overwrite them accidentally.
- Redeploy after changing `APP_URL`. Environment changes do not alter an already-built deployment.
- Before changing `APP_URL`, verify all three hostname responses: apex returns a permanent redirect to `www`, `www` renders Coming Soon, and `app` renders the login/application with an `X-Robots-Tag` noindex header.
- Keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, Stripe keys, and Twilio credentials unchanged unless a provider/project is also being replaced.

`APP_URL` currently controls:

- Stripe Connect onboarding return and refresh URLs.
- Stripe-hosted payer card-setup success/cancel URLs.
- Billing approval links sent by SMS.
- Twilio delivery-status callback URLs attached to outbound messages.
- Exact public URLs used for Twilio webhook-signature validation.

### Twilio Messaging Service

Current temporary-domain configuration was manually confirmed on 2026-08-09: incoming, fallback, and status callbacks use the three routes below; Advanced Opt-Out is enabled and its custom opt-out, opt-in, and HELP copy is saved. Toll-free verification is still in review.

Direction changed on 2026-08-11 after that generic submission was rejected. Treat the configuration below as the legacy/development Messaging Service until it is assigned exclusively to the first school. Production SMS uses one subaccount, number, Messaging Service, verification, and school-specific public consent URL per add-on school. At domain cutover, inventory and update every active school Messaging Service rather than only the original service.

Change all three integrations to the production origin and keep HTTP `POST`:

- Incoming message URL: `https://app.commontime.studio/api/twilio/incoming`
- Fallback URL: `https://app.commontime.studio/api/twilio/incoming/fallback`
- Delivery Status Callback: `https://app.commontime.studio/api/twilio/status`

Also review and update every public URL supplied during toll-free verification:

- School-specific opt-in form: `https://www.commontime.studio/sms/<school-public-slug>` once the marketing/public compliance site exists
- Privacy policy: `https://www.commontime.studio/privacy`
- Terms: `https://www.commontime.studio/terms`
- Support/help: `https://www.commontime.studio/support`

Until those public routes move to the marketing site, their `https://app.commontime.studio` equivalents may be used only if they remain publicly reachable without login. Never submit the authenticated application root as the end-business website.

Review the Messaging Service's **Opt-Out Management** copy even though these messages are stored in Twilio rather than this repository. Replace both the temporary product name and temporary hostname with the final public brand/domain:

- Opt-out confirmation currently begins `MusicSchool:`.
- Opt-in confirmation currently begins `MusicSchool:`.
- Help confirmation currently begins `MusicSchool help:` and contains `musicschool-alpha.vercel.app/support`.
- Confirm the final product name is also correct in the Messaging Service friendly name, toll-free verification submission, consent disclosure, privacy policy, terms, support page, and outbound SMS templates.
- Recheck that every message still identifies the sender, explains STOP/HELP behavior where appropriate, and fits the intended SMS segment count after the copy changes.

If Twilio does not permit editing an approved or pending toll-free submission, open a support request before retiring the temporary domain. Do not delete the temporary Vercel alias while Twilio may still review or visit those URLs.

No Twilio SID, auth token, API key, Messaging Service SID, or phone number changes merely because the app domain changes.

Before launch, recheck the Messaging Service validity period. It was observed at `36000` seconds (10 hours), but a final change was not confirmed; choose and record the intended retry window rather than inheriting the dashboard default accidentally.

### Stripe

Review each webhook destination in both test and live mode. The current application endpoint is:

- `https://app.commontime.studio/api/stripe/webhooks`

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

Review these Stripe dashboard surfaces even though they are not read from application environment variables:

- Platform/Connect business profile website and support URL.
- Public business information, branding, statement/support information, and customer-facing contact details.
- Connect onboarding or account-management branding links.
- Customer Portal configuration and portal return URLs if Stripe Billing/Portal has been enabled by cutover time.
- Payment Links, Checkout configurations, or hosted pages created manually in Stripe that contain an after-completion redirect.
- Apple Pay/payment-method domain registration if those methods are enabled later.
- Test-mode and live-mode settings separately; Stripe does not automatically copy every setting between them.

### Supabase Authentication

In Authentication → URL Configuration:

- Change **Site URL** to the production origin.
- Add the production callback to **Redirect URLs**:
  - `https://app.commontime.studio/auth/callback`
- Temporarily retain the local and Vercel callbacks during testing:
  - `http://localhost:3001/auth/callback`
  - `https://musicschool-alpha.vercel.app/auth/callback`
- Remove the temporary Vercel callback only after production login, logout, onboarding, and protected-route return behavior pass.

The Supabase project URL and JWKS URL remain unchanged:

- `NEXT_PUBLIC_SUPABASE_URL`
- `https://<supabase-project-ref>.supabase.co/auth/v1/.well-known/jwks.json`

Also review:

- Auth email templates for hardcoded temporary links or branding URLs.
- Custom SMTP sender/domain configuration when transactional auth email is enabled.
- CAPTCHA allowed domains if CAPTCHA is enabled later.
- WebAuthn relying-party ID/origins if passkeys are enabled later.
- Any Edge Function secrets, scheduled jobs, database webhooks, or Storage transform URLs added after this runbook was written.

The checked-in `supabase/config.toml` currently contains local-development URLs. Those are local CLI settings, not the hosted project's production Site URL; do not replace them merely for a production-domain cutover.

### Google Cloud OAuth

The Google OAuth **Authorized redirect URI** normally remains the Supabase callback, not the app callback:

- `https://twhexxokrjwzsoxgzlme.supabase.co/auth/v1/callback`

Do not replace that URI merely because the application domain changed.

Review the OAuth web client and consent/branding configuration for references to the temporary domain:

- Add `https://app.commontime.studio` to Authorized JavaScript origins if origins are configured.
- Use `https://www.commontime.studio` for the OAuth consent screen home page/privacy/terms links once the marketing site exists.
- Replace temporary home page, privacy policy, terms, and authorized-domain entries with the real domain where applicable.
- Keep the Supabase redirect URI.
- Reverify the OAuth consent screen/domain if Google requests it.

No Google client ID or client secret rotation is required solely for a domain change.

If Gmail, Calendar, Drive, Maps, reCAPTCHA, or another Google API is added later, separately review that API's allowed origins, redirect URIs, referrer restrictions, webhook channels, and OAuth verification submission.

### Domain Registrar And DNS

- Confirm the domain is owned by the product/business account, not only a developer's personal account.
- Record registrar access, nameservers, DNS host, renewal date, auto-renew status, recovery contacts, and MFA ownership.
- Add only the DNS records Vercel requests; preserve unrelated mail and verification records.
- Review CAA records so Vercel can issue the TLS certificate.
- Review DNSSEC compatibility before changing nameservers; do not strand a stale DS record at the registrar.
- After propagation, verify both the intended hostname and any apex/`www` redirect behavior.
- Decide which hostname is canonical and ensure other public hostnames redirect to it rather than serving duplicate applications.

### Browser Security, Metadata, And Installable App Settings

These are not currently configured with a hardcoded production hostname, but must be reviewed whenever they are added:

- Content Security Policy `connect-src`, `form-action`, `frame-ancestors`, and report endpoints.
- CORS and CSRF trusted-origin lists.
- Cookie `Domain` attributes. Current Supabase SSR cookies are host-scoped and do not hardcode the Vercel hostname.
- `metadataBase`, canonical URLs, Open Graph/Twitter image URLs, sitemap, robots, and structured data.
- Web app manifest `start_url`, `scope`, shortcuts, share targets, and app-association files.
- iOS Universal Links and Android App Links (`apple-app-site-association` and `assetlinks.json`) if native apps are added.
- Service worker caches containing absolute URLs.

The current login, OAuth callback, sign-out, and Stripe return-route redirects are built from `window.location.origin` or the incoming request URL, so they follow the active hostname automatically. Provider allowlists still need the changes listed above.

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

### Email And Support Infrastructure

When email is present, inventory all of the following in addition to changing links:

- Sending domain/subdomain in Resend or the selected email provider.
- SPF, DKIM, DMARC, MX, return-path, and provider-verification DNS records.
- Email webhook URLs and their signing secrets.
- Template links, logo/image URLs, unsubscribe/preferences URLs, and support addresses.
- Supabase Auth custom SMTP and templates separately from application transactional email.
- `admin@`, `billing@`, `privacy@`, and `support@` forwarding/mailboxes.

### Monitoring, Analytics, And Operations

Review every service present at cutover time:

- Sentry allowed origins, release/deploy environment, tunnel URL, and CSP report target.
- PostHog or other analytics authorized domains, reverse proxy, and recording exclusions.
- Uptime checks, synthetic tests, status page, log drains, and alert links.
- Vercel deployment protection, firewall rules, bot controls, redirects, and cron targets.
- Password-manager entries, incident runbooks, customer-support macros, internal bookmarks, and QR codes.
- API clients, Postman collections, CLI scripts, fixtures, seed data, and third-party Zapier/Make-style automations.

### Items Confirmed Unchanged In The Current Code Audit

As of 2026-08-09, a repository-wide scan confirmed:

- No application source file hardcodes `musicschool-alpha.vercel.app`.
- `APP_URL` is the only implemented environment variable whose value changes for a domain-only cutover.
- Supabase URL/keys, Stripe keys, and Twilio credentials remain provider/project identifiers rather than app-domain values.
- Google login constructs the app callback from the browser origin.
- Auth callback, sign-out, and Stripe payment-return routes construct redirects from the incoming request origin.
- No custom cookie domain, CSP, CORS allowlist, canonical metadata URL, sitemap, manifest, service worker, analytics, monitoring, or transactional-email provider is currently configured.
- No GitHub Action or repository configuration currently references the temporary application hostname.

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
