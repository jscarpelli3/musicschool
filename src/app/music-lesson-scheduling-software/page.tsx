import {SeoLandingPage} from "@/components/marketing/seo-landing-page";
import {seoMetadata} from "@/lib/marketing/seo-metadata";

export const metadata=seoMetadata("Music Lesson Scheduling Software | Common Time","Schedule recurring and one-time music lessons, find openings, manage availability, and handle rescheduling without losing the teaching context.","/music-lesson-scheduling-software");

export default function Page(){return <SeoLandingPage eyebrow="Music lesson scheduling software" title="Your teaching calendar, without the weekly puzzle." introduction="If your schedule currently lives in Google Calendar, a paper planner, or a spreadsheet, Common Time gives it a home built specifically for music lessons. Set up the regular week once, then handle cancellations, makeups, and one-time changes without losing track." promise="Open the calendar and know who is coming, when they arrive, and what changed." image={{src:"/images/unsplash/violin-sheet-music.webp",alt:"A violin beside well-used sheet music",position:"center",creditName:"Stefany Andrade",creditHref:"https://unsplash.com/@stefany_andrade?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText",sourceHref:"https://unsplash.com/photos/brown-violin-with-case-GbSCAAsU2Fo?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"}} sections={[
 {title:"Set up the regular week once",body:"Create a student’s repeating lesson, then change one Tuesday without changing every Tuesday that follows."},
 {title:"Find an open time",body:"See which teachers, rooms, and times are available without comparing paper notes, text messages, and separate calendars."},
 {title:"Keep makeups from disappearing",body:"A cancellation, the reason for it, and the replacement lesson stay connected so the loose ends do not depend on memory."},
]} detailTitle="Made for the way music lessons actually move." details={[
 "See the date, start time, student, teacher, length, and location at a glance.",
 "If you teach alone, Common Time stops asking you to choose the same teacher every time.",
 "Use your normal availability to find openings, but make an exception whenever you need to.",
 "Keep regular lessons and one-time appointments beside the student and family information they belong to.",
]} related={[
 {href:"/software-for-independent-music-teachers",label:"For independent teachers",description:"Keep a private studio organized without adding office work."},
 {href:"/music-school-billing-software",label:"Billing and payments",description:"Turn the lessons on your calendar into clear invoices."},
 {href:"/music-school-management-software",label:"School management",description:"Keep teachers, families, schedules, and billing in one place."},
]}/>}
