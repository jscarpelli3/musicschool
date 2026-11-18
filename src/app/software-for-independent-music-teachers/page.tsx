import {SeoLandingPage} from "@/components/marketing/seo-landing-page";
import {seoMetadata} from "@/lib/marketing/seo-metadata";

export const metadata=seoMetadata("Software for Independent Music Teachers | Common Time","Simple scheduling, student management, invoicing, payments, and rescheduling software for independent and private music teachers.","/software-for-independent-music-teachers");

export default function Page(){return <SeoLandingPage eyebrow="Software for independent music teachers" title="Run the studio without turning teaching into office work." introduction="Common Time gives a private music teacher one place for the weekly schedule, students and families, invoices, payments, and the inevitable lesson changes—without making a solo studio behave like a corporation." promise="The useful structure of school software, adjusted to the reality that the teacher is also the owner." sections={[
 {title:"Solo mode conveniences",body:"When there is one teacher, Common Time chooses that teacher automatically and removes decisions that do not add value."},
 {title:"Families stay connected",body:"Keep each student linked to the payer, lesson schedule, invoice history, payment method, and family portal access."},
 {title:"A calmer money routine",body:"Prepare invoices from scheduled lessons, collect through Stripe, or record cash, check, and other outside payments."},
]} detailTitle="Enough organization to protect your time." details={[
 "Start at $10 per month after a seven-day trial, with the current Common Time workspace included in the Opus One plan.",
 "Schedule recurring students and still make a one-week exception without rebuilding the teaching calendar.",
 "Use billing reminders as a preferred rhythm, never as a restriction on when you are allowed to invoice.",
 "Open the progressive web app from a phone for quick access to the same school information used on desktop.",
]} related={[
 {href:"/music-lesson-scheduling-software",label:"Lesson scheduling",description:"Build the week and handle changes without breaking the series."},
 {href:"/music-school-billing-software",label:"Billing and payments",description:"Invoice families and keep a clear settlement history."},
 {href:"/music-school-management-software",label:"Growing schools",description:"See how the same system supports a teaching team."},
]}/>}
