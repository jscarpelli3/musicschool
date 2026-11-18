import {SeoLandingPage} from "@/components/marketing/seo-landing-page";
import {seoMetadata} from "@/lib/marketing/seo-metadata";

export const metadata=seoMetadata("Music School Billing Software | Common Time","Prepare music lesson invoices, collect Stripe payments, record outside payments, and keep refunds and adjustments clear for every family.","/music-school-billing-software");

export default function Page(){return <SeoLandingPage eyebrow="Music school billing software" title="See what each family owes—and get paid without chasing a spreadsheet." introduction="Common Time turns the lessons on your calendar into invoices you can review before sending or charging. Families can approve the amount, pay securely by card, or use the payment arrangement you already have with them." promise="Know what you billed, what came in, what you refunded, and what is still unpaid." image={{src:"/images/unsplash/keyboard-studio.webp",alt:"A music keyboard and headphones beside paperwork",position:"center 55%",creditName:"Panagiotis Falcos",creditHref:"https://unsplash.com/@falcos?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText",sourceHref:"https://unsplash.com/photos/a-keyboard-with-headphones-and-a-microphone-GgjNItqNiok?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"}} sections={[
 {title:"Start with the lessons",body:"Choose a month of scheduled lessons or begin with a blank invoice, then include only the dates and adjustments that belong on the bill."},
 {title:"Collect payment your way",body:"Charge a family’s saved card, send a secure one-time payment link, or record money you received by cash, check, or bank transfer."},
 {title:"Keep a history you can follow",body:"Payments, refunds, corrections, and forgiven balances stay visible so you can understand what happened later."},
]} detailTitle="Clear enough for you and the family." details={[
 "A family sees and approves the exact invoice before you collect it.",
 "Stripe securely handles card details; Common Time never stores the card number.",
 "Record cash, checks, and bank transfers alongside card payments without mixing them up.",
 "A partial payment or refund stays visible instead of quietly changing the original bill.",
]} related={[
 {href:"/music-lesson-scheduling-software",label:"Lesson scheduling",description:"Keep the dates and times behind each invoice clear."},
 {href:"/software-for-independent-music-teachers",label:"For solo teachers",description:"A straightforward way to bill a private studio."},
 {href:"/music-school-management-software",label:"School management",description:"Keep billing beside the rest of the school’s work."},
]}/>}
