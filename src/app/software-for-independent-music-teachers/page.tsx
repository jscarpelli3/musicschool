import {SeoLandingPage} from "@/components/marketing/seo-landing-page";
import {seoMetadata} from "@/lib/marketing/seo-metadata";

export const metadata=seoMetadata("Software for Independent Music Teachers | Common Time","Simple scheduling, student management, invoicing, payments, and rescheduling software for independent and private music teachers.","/software-for-independent-music-teachers");

export default function Page(){return <SeoLandingPage eyebrow="Software for independent music teachers" title="Spend less time running the studio. Keep more time for teaching." introduction="A private studio often starts with a calendar, a contact list, a spreadsheet, and a lot of remembering. Common Time brings your students, weekly schedule, lesson changes, invoices, and payments together without making a one-teacher business feel like a large company." promise="One straightforward place to see today’s lessons, each family, and what still needs your attention." image={{src:"/images/unsplash/andrey-k-piano-lesson.jpg",alt:"A piano teacher helping a young student place her fingers on the keys",position:"center 55%",creditName:"Andrey K",creditHref:"https://unsplash.com/@anamnesis33?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText",sourceHref:"https://unsplash.com/photos/a-woman-and-a-little-girl-playing-a-piano-aOLDCqOEFDo?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"}} sections={[
 {title:"Built for one teacher, too",body:"When you are the only teacher, Common Time fills that in automatically and leaves out extra staff choices you do not need."},
 {title:"Know each family’s whole story",body:"Open one family record to find the students, their lesson times, invoices, payments, and contact information."},
 {title:"Make getting paid routine",body:"Build invoices from the lessons you scheduled, collect a card payment through Stripe, or record cash, check, and bank payments."},
]} detailTitle="Enough organization to protect your time." details={[
 "Start at $10 per month after a seven-day trial; cancel whenever you need to.",
 "Set up weekly students once and change a single week without rebuilding the calendar.",
 "Choose the days you prefer to prepare invoices and charge families, while keeping the freedom to bill whenever you need to.",
 "Install Common Time on your phone for quick access to the same information you see on your computer.",
]} related={[
 {href:"/music-lesson-scheduling-software",label:"Lesson scheduling",description:"Build the regular week and handle changes without starting over."},
 {href:"/music-school-billing-software",label:"Billing and payments",description:"Invoice families and see what was paid, refunded, or still owed."},
 {href:"/music-school-management-software",label:"Growing schools",description:"See how the same system can support more teachers later."},
]}/>}
