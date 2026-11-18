import {SeoLandingPage} from "@/components/marketing/seo-landing-page";
import {seoMetadata} from "@/lib/marketing/seo-metadata";

export const metadata=seoMetadata("Music Lesson Scheduling Software | Common Time","Schedule recurring and one-time music lessons, find openings, manage availability, and handle rescheduling without losing the teaching context.","/music-lesson-scheduling-software");

export default function Page(){return <SeoLandingPage eyebrow="Music lesson scheduling software" title="A music lesson schedule that understands the teaching week." introduction="Common Time keeps recurring lessons steady while making room for the exceptions that define real teaching: a changed Tuesday, an owed makeup, a family request, or a teacher who needs a different room." promise="See the date and time first—then every person, policy, and payment connected to it." sections={[
 {title:"Recurring without being rigid",body:"Create a weekly series once, then change or cancel one occurrence without rewriting the rest of the student’s schedule."},
 {title:"Find a real opening",body:"Search teaching availability by teacher, lesson length, day, time, and place instead of comparing separate calendars by hand."},
 {title:"Reschedule with context",body:"Keep the request, policy timing, owner decision, replacement lesson, and billing effect connected to the original lesson."},
]} detailTitle="Scheduling designed around lessons, not generic appointments." details={[
 "The calendar emphasizes the lesson date, start time, student, teacher, duration, and place—the details teachers actually use to recognize their day.",
 "Solo schools skip unnecessary teacher choices; multi-teacher schools retain the controls needed to coordinate a full teaching team.",
 "Availability guides suggestions without preventing an owner from deliberately scheduling an exception.",
 "One-time lessons and recurring series live in the same system as students, families, invoices, and payment history.",
]} related={[
 {href:"/software-for-independent-music-teachers",label:"For independent teachers",description:"A quieter workflow for a solo teaching business."},
 {href:"/music-school-billing-software",label:"Billing and payments",description:"Turn the lessons on the calendar into clear invoices."},
 {href:"/music-school-management-software",label:"School management",description:"Coordinate people, teaching, schedules, and money."},
]}/>}
