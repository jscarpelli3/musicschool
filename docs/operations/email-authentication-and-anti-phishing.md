# Email authentication and anti-phishing runbook

Last verified: 2026-09-16

Common Time sends transactional mail from `notifications@notifications.commontime.studio`. School names may appear in the display name, but a school-controlled address is only used as `Reply-To`. Application links in outgoing mail must use `https://app.commontime.studio`.

## Protections enforced by the application

- The mail transport rejects any `From` address outside the authenticated Common Time notification domain.
- Display names are stripped of line breaks and email-header delimiters.
- Every text and HTML message identifies `app.commontime.studio` as the only trusted application domain.
- The transport rejects links to any other origin before handing a message to Resend.
- Billing messages also explain that the payer can open the portal directly instead of following the email action link.
- Schools may configure a reply address; it is normalized and sent as `Reply-To`, never `From`.
- Repeated deliveries retain their existing idempotency keys.

Do not weaken these checks for a new email type. Build the content with `secureEmailContent`, build the sender with `schoolEmailSender`, and send it through `sendResendEmail`.

## Current public DNS state

The following was observed through the system resolver, Cloudflare `1.1.1.1`, and Google `8.8.8.8` on 2026-09-16:

- `_dmarc.commontime.studio`: `v=DMARC1; p=quarantine; sp=quarantine; pct=100`
- `_dmarc.notifications.commontime.studio`: `v=DMARC1; p=quarantine; pct=100`
- `send.notifications.commontime.studio`: Resend SPF and feedback MX are present.
- `resend._domainkey.notifications.commontime.studio`: Resend DKIM is present.
- The former wildcard CNAME to `pixie.porkbun.com` is removed; a random undefined subdomain returns no record.
- The apex has no explicit SPF record and no null MX record.

DMARC quarantine enforcement is active at both the organizational and notification domains. Resend sending authentication remains intact.

## DNS follow-up

The initial quarantine deployment and wildcard removal are complete. Do not replace Resend-generated SPF, MX, or DKIM values with examples from this document.

1. Create a mailbox or reporting service that can receive aggregate DMARC reports. Use that controlled address in the `rua` value below.
2. Add that reporting address as `rua=mailto:DMARC_REPORT_ADDRESS` to both existing DMARC records.
3. Review reports for at least one normal billing cycle. When all legitimate sources pass and align, change both policies from `p=quarantine` to `p=reject` (and the apex `sp` to `reject`).
4. If the apex never sends or receives mail, publish `v=spf1 -all` as its SPF TXT record and `0 .` as its null MX. Only do this after confirming no human or vendor sends as `@commontime.studio`.
5. Keep the Resend-generated SPF, feedback MX, and DKIM records under `notifications.commontime.studio`. Do not add a second SPF TXT record at the same hostname.
6. Do not restore the broad wildcard CNAME. Keep explicit TXT records for every `_dmarc` name.

Start with quarantine rather than jumping straight to reject because the current aggregate reports have not yet been reviewed. Moving to reject is the target state, not an optional cleanup.

## Resend settings

In Resend, open Domains → `notifications.commontime.studio`:

- Confirm the domain, SPF, and DKIM all show as verified.
- Keep open tracking and click tracking disabled. Click tracking rewrites application links through a redirect domain, which conflicts with the promise that email links visibly use `app.commontime.studio`.
- Confirm the displayed DNS records still exactly match public DNS after every provider or region change.

Tracking is a domain setting, not a per-message option in the current mail transport. Recheck it manually whenever the Resend domain is re-created.

## Verification commands

After DNS changes propagate, run:

```sh
dig +short TXT _dmarc.commontime.studio
dig +short TXT _dmarc.notifications.commontime.studio
dig +short TXT send.notifications.commontime.studio
dig +short MX send.notifications.commontime.studio
dig +short TXT resend._domainkey.notifications.commontime.studio
dig +short TXT commontime.studio
dig +short MX commontime.studio
```

Then send a test message to an inbox you control and inspect the original headers. `SPF`, `DKIM`, and `DMARC` should all report `PASS`; the visible From domain should be `notifications.commontime.studio`; and application links should begin with `https://app.commontime.studio/`.

Finally, test replying to the message. It should go to the school's configured reply address, or remain addressed to the Common Time notification sender when the school has not configured one.

## Incident response

If a payer reports a suspicious message:

1. Tell them not to click it and not to enter payment information.
2. Ask them to open `https://app.commontime.studio/portal` directly and verify the invoice there.
3. Preserve the original message with full headers; a forwarded screenshot is not enough to authenticate it.
4. Compare the message ID and action with the application's delivery record and the Resend log.
5. If it is forged, review DMARC reports and move an already-clean domain from quarantine to reject. If it is an unauthorized real send, rotate the Resend API key immediately and inspect deployment secrets and application logs.
