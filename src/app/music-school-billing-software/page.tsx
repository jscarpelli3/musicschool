import {SeoLandingPage} from "@/components/marketing/seo-landing-page";
import {seoMetadata} from "@/lib/marketing/seo-metadata";

export const metadata=seoMetadata("Music School Billing Software | Common Time","Prepare music lesson invoices, collect Stripe payments, record outside payments, and keep refunds and adjustments clear for every family.","/music-school-billing-software");

export default function Page(){return <SeoLandingPage eyebrow="Music school billing software" title="Billing that begins with what was actually taught and scheduled." introduction="Common Time connects invoices to the lessons, families, dates, and decisions behind them. Owners can prepare an invoice when they choose, let a payer approve it, and collect through Stripe or record money received elsewhere." promise="Know what the invoice covers, what was paid, what changed, and what remains." sections={[
 {title:"Build from lesson records",body:"Start with a service month or an empty invoice, then include the specific lessons and adjustments that belong on this bill."},
 {title:"Collect the appropriate way",body:"Charge an authorized saved card, send a one-time Stripe link, or mark an invoice for outside payment only."},
 {title:"Preserve the history",body:"Payments, write-offs, reversals, and refunds remain separate activity so an owner can understand how an invoice was resolved."},
]} detailTitle="A payment flow the school can explain." details={[
 "Payers review the exact amount before the school collects it, while owners retain control over when collection happens.",
 "Stripe handles secure card information; Common Time stores provider references rather than card numbers or bank credentials.",
 "Cash, check, bank transfer, and other outside payments can be recorded without pretending they happened in Stripe.",
 "Partial payments and refunds show their own audit entries without silently rewriting the original invoice total.",
]} related={[
 {href:"/music-lesson-scheduling-software",label:"Lesson scheduling",description:"Keep the source dates and times behind each invoice clear."},
 {href:"/software-for-independent-music-teachers",label:"For solo teachers",description:"A straightforward billing rhythm for a private studio."},
 {href:"/music-school-management-software",label:"School management",description:"Bring billing into the rest of school operations."},
]}/>}
