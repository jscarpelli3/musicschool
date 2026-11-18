import {SeoLandingPage} from "@/components/marketing/seo-landing-page";
import {seoMetadata} from "@/lib/marketing/seo-metadata";

export const metadata=seoMetadata("Music School Management Software | Common Time","Manage music school schedules, teachers, students, families, invoices, payments, policies, and rescheduling decisions in one connected workspace.","/music-school-management-software");

export default function Page(){return <SeoLandingPage eyebrow="Music school management software" title="Keep the whole school out of scattered calendars and spreadsheets." introduction="Common Time gives a music school one place for teachers, students, families, weekly lessons, schedule changes, invoices, and payments. Start with the parts you need today, whether you teach alone or coordinate a growing team." promise="See what is happening across the school without losing the details of each student and lesson." image={{src:"/images/unsplash/music-ensemble.webp",alt:"A group holding up guitars, a keyboard, microphones, and other instruments",position:"center 72%",creditName:"Caleb George",creditHref:"https://unsplash.com/@seemoris?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText",sourceHref:"https://unsplash.com/photos/grayscale-photo-of-people-holding-assorted-music-instruments-pH88tHG-1yw?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"}} sections={[
 {title:"Everyone in the right place",body:"Keep teachers, students, parents and payers, instruments, lesson locations, and contact details together instead of in separate lists."},
 {title:"One view of the teaching week",body:"See regular lessons, teacher availability, cancellations, makeup requests, and schedule changes in the same calendar."},
 {title:"Billing beside the schedule",body:"Move from the lessons that happened to family approval, card payment, refunds, and invoice history without opening another system."},
]} detailTitle="Ready for one teacher or a growing team." details={[
 "Arrange the dashboard so the information you check most often appears first.",
 "See each teacher’s lessons and availability, while a one-teacher school skips unnecessary staff choices.",
 "Give families a simple place to approve invoices, manage payment methods, and see their school information.",
 "Keep a reschedule request and your decision beside the lesson, so you and the family can follow what happened.",
]} related={[
 {href:"/music-lesson-scheduling-software",label:"Lesson scheduling",description:"Set up the regular week and handle the changes that follow."},
 {href:"/music-school-billing-software",label:"Billing and payments",description:"Turn scheduled lessons into invoices and collect payment."},
 {href:"/software-for-independent-music-teachers",label:"For independent teachers",description:"See how Common Time works for a one-teacher studio."},
]}/>}
