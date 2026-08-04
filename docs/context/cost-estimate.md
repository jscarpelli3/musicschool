# Cost Estimate

## Scope Assumption

This estimate is for a small multi-tenant SaaS beginning with one private music school.

- Around 50 to 60 students today
- Low-traffic usage
- One owner using the system heavily
- One teacher initially
- Parents or guardians logging in occasionally, likely around once per month on average
- Square handles invoices and payment collection on Square-hosted pages
- The app handles scheduling, account management, and business operations

Additional schools share the application and database rather than receiving separate deployments.

## Recommended Stack

- Hosting: Vercel
- Database, authentication, and file storage: Supabase
- Data access: Supabase clients and generated TypeScript types
- Authentication: Supabase Auth with Google OAuth
- SaaS subscriptions: Stripe
- Payments: Square-hosted invoices and payment pages
- Email: optional transactional provider such as Resend
- SMS: optional provider such as Twilio

## Expected Starting Cost

### Likely monthly baseline

- Vercel Hobby: $0 for personal, non-commercial development only
- Supabase Free: $0 for development
- Google OAuth: no separate platform subscription expected for basic login
- Square platform fee: $0 fixed monthly, plus transaction fees

## Practical development estimate

For development and a non-commercial prototype, the likely infrastructure cost can stay at:

- $0 per month for app hosting and database

That assumes:

- low traffic
- modest database size
- no unusually heavy server-side jobs
- externalized payment processing through Square

## Practical production estimate

Do not budget a commercial production launch at $0:

- Vercel requires Pro or Enterprise for commercial use; Pro currently starts at $20 per month and includes usage credit.
- Supabase Free is useful during development, but free projects pause after one week of inactivity and do not include managed database backups. Supabase Pro currently starts at $25 per month for a production organization.
- A sensible initial production infrastructure allowance is therefore roughly $45 per month before optional email, SMS, monitoring, domains, payment fees, taxes, or usage overages.
- Stripe SaaS transaction fees and Square family-payment fees are separate variable costs.

## Optional service costs

### Email

Transactional email is useful for:

- login links or account notifications
- lesson reminders
- schedule changes

Resend pricing currently starts at:

- Free: $0 for 3,000 emails per month, with a 100 email per day limit
- Pro: $20 per month for 50,000 emails

For one 50-student school, free email limits are likely enough at first.

### SMS

SMS is optional, but useful for reminders and schedule changes.

Twilio pricing currently starts at:

- outbound U.S. SMS from about $0.0083 per message
- additional carrier fees apply
- A2P registration is also required for standard U.S. business texting

For a small school, SMS cost is likely low in absolute dollars, but it adds compliance setup and recurring per-message charges.

## Square costs

Square is expected to be the largest ongoing cost because it is usage-based on collected payments.

Current Square U.S. fees for invoices and online payments on the free tier:

- card payments through online or invoice flows: 3.3% + 30 cents
- ACH via invoice: 1% with a $1 minimum

## Example payment-fee scenarios

These are rough planning examples, not exact forecasts.

### Example A: 50 students, average billed amount of $200 per month

- monthly volume: about $10,000
- if paid mostly by card across 50 invoices:
- estimated Square fees: about $345 per month

### Example B: 50 students, average billed amount of $300 per month

- monthly volume: about $15,000
- if paid mostly by card across 50 invoices:
- estimated Square fees: about $510 per month

### Example C: 100 students, average billed amount of $250 per month

- monthly volume: about $25,000
- if paid mostly by card across 100 invoices:
- estimated Square fees: about $855 per month

If a meaningful share of customers pays by ACH through Square invoices, fees can be materially lower.

## Near-term recommendation

For development, plan around:

- App infrastructure: $0 per month while non-commercial
- Email: $0 per month to start
- SMS: $0 until enabled
- Square: transaction fees only

## Planning budget

If you want one simple budgeting number for the current school:

- Fixed app cost during development: $0 to start
- Initial commercial production allowance: about $45 per month, plus a domain and optional providers
- Payment processing: Stripe fees for SaaS subscriptions and Square fees for family payments

The biggest financial variable is not hosting. It is how much tuition or other billables run through Square each month.

## Multi-tenant note

- Additional schools initially share Vercel and Supabase infrastructure.
- Each school should connect its own Square merchant account; its processing fees remain tied to its own payment volume.
- Schools pay the software business through Stripe subscriptions.
- Infrastructure cost grows by shared usage rather than by duplicating a deployment and database for every school.

## Sources

- Vercel pricing: https://vercel.com/pricing
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Supabase pricing: https://supabase.com/pricing
- Square fees: https://my.squareup.com/help/us/en/article/5068-what-are-square-s-fees
- Square invoices: https://squareup.com/help/us/en/article/6636-manage-your-invoices-with-square-invoices-app
- Twilio SMS pricing: https://www.twilio.com/en-us/sms/pricing/usa
- Twilio general pricing: https://www.twilio.com/en-us/pricing
- Resend pricing: https://resend.com/pricing
