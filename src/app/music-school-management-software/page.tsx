import {SeoLandingPage} from "@/components/marketing/seo-landing-page";
import {seoMetadata} from "@/lib/marketing/seo-metadata";

export const metadata=seoMetadata("Music School Management Software | Common Time","Manage music school schedules, teachers, students, families, invoices, payments, policies, and rescheduling decisions in one connected workspace.","/music-school-management-software");

export default function Page(){return <SeoLandingPage eyebrow="Music school management software" title="Keep the moving parts of a music school in time." introduction="Common Time brings the teaching calendar, staff availability, students, families, policies, invoices, and payments into one operational record. It is compact enough for an independent teacher and structured enough for a growing school." promise="A school-wide view without losing the lesson-level detail that makes the work make sense." sections={[
 {title:"People in context",body:"Connect teachers, students, payers, instruments, places, and lesson types instead of maintaining disconnected contact lists."},
 {title:"The teaching operation",body:"Coordinate weekly availability, recurring lessons, exceptions, owner approvals, replacement lessons, and outstanding schedule work."},
 {title:"The financial record",body:"Move from lesson activity to payer approval, collection, refunds, and invoice history without switching systems."},
]} detailTitle="Built to grow without becoming impersonal." details={[
 "A reorderable dashboard lets each owner put the most useful operational sections first.",
 "Multi-teacher schools can see teaching responsibilities and availability while solo studios avoid unnecessary staff selection.",
 "Family portals give payers a focused place for approvals, payment methods, and their students’ school relationship.",
 "Policies and rescheduling decisions stay attached to the lesson involved, leaving a clearer record for the owner and family.",
]} related={[
 {href:"/music-lesson-scheduling-software",label:"Lesson scheduling",description:"See how recurring teaching and exceptions work together."},
 {href:"/music-school-billing-software",label:"Billing and payments",description:"Follow lessons through invoicing and collection."},
 {href:"/software-for-independent-music-teachers",label:"For independent teachers",description:"Use the same system with solo-mode conveniences."},
]}/>}
