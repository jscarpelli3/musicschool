import type {Metadata} from "next";
import {CommonTimeLogo} from "@/components/brand/common-time-logo";
import {ParallaxPhoto} from "@/components/marketing/parallax-photo";

export const metadata:Metadata={
 title:{absolute:"Music Lesson Scheduling & Billing Software | Common Time"},
 description:"Music lesson scheduling, invoicing, payments, rescheduling, and student management software for independent music teachers and music schools. Start free for seven days.",
 alternates:{canonical:"https://www.commontime.studio"},
 robots:{index:true,follow:true},
 openGraph:{
  type:"website",
  url:"https://www.commontime.studio",
  siteName:"Common Time",
  title:"Music Lesson Scheduling & Billing Software | Common Time",
  description:"Run lesson schedules, families, invoices, payments, and rescheduling from one calm workspace built for music teachers.",
 },
 twitter:{card:"summary_large_image",title:"Common Time for Music Teachers",description:"Music lesson scheduling, billing, payments, and school management in one calm workspace."},
};
const coming=[
 {title:"The Resource Commons",text:"A friendly school community for sharing teaching PDFs, useful links, studio resources, and practical ideas for running a school.",accent:true,label:"Community"},
 {title:"A fuller teacher portal",text:"Lesson notes, student context, follow-ups, and the everyday teaching record—built around the teacher’s own schedule.",accent:true,label:"Teaching"},
 {title:"SMS support",text:"Optional school-specific text reminders and timely updates, with proper consent and dedicated messaging setup.",accent:true,label:"Communication"},
 {title:"Prospects and waitlists",text:"Capture inquiries, organize a waitlist, and deliberately turn a prospect into an enrolled student without entering everything twice.",label:"Enrollment"},
 {title:"Substitutes and makeups",text:"Assign a substitute for one occurrence, schedule owed lessons, and handle irregular or ad-hoc teaching cleanly.",label:"Scheduling"},
 {title:"Workload and payroll reporting",text:"Understand who actually taught each lesson and turn that history into clearer workload and compensation reports.",label:"Reporting"},
 {title:"Friendlier imports",text:"Bring in students and families from CSV or Google Contacts, with calendar-assisted schedule imports planned after that.",label:"Getting started"},
];
const appUrl="https://app.commontime.studio";
const trialHref=`${appUrl}/login?next=%2Fsetup%3Ftrial%3D1`;

export default function StartPage(){return <main className="min-h-screen bg-canvas text-ink">
 <section className="relative overflow-hidden border-b border-line/70">
  <ParallaxPhoto src="/images/unsplash/music-ensemble.webp" alt="" sizes="100vw" objectPosition="center 58%" tintClassName="bg-canvas/85"/>
  <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between border-b border-white/20 px-5 py-6 sm:px-8"><CommonTimeLogo light className="-ml-2 w-44 sm:ml-0"/><a href={`${appUrl}/login`} className="text-sm text-white/75 transition hover:text-white">Log in</a></header>
  <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-8 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
   <div><p className="text-xs uppercase tracking-[0.16em] text-brand">Music lesson scheduling and billing software</p><h1 className="mt-5 max-w-3xl font-display text-6xl leading-[0.95] tracking-[-0.04em] sm:text-7xl">More time teaching. Less time piecing it all together.</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-ink/75">Schedule music lessons, manage students and families, prepare invoices, and collect payments from one calm workspace built for independent teachers and music schools.</p><div className="mt-9 flex flex-wrap items-center gap-5"><a href={trialHref} className="rounded-control bg-ink px-6 py-3 text-sm text-canvas">Start seven days free</a><span className="text-sm text-ink/70">Card required · cancel anytime</span></div></div>
   <aside className="overflow-hidden rounded-card border border-white/50 bg-surface/85 shadow-xl shadow-ink/10 backdrop-blur-md"><div className="bg-brand/10 p-7"><div className="flex items-center justify-between gap-4"><p className="text-xs uppercase tracking-[0.14em] text-brand">Opus One</p><span className="rounded-full bg-surface px-3 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-brand">Founding plan</span></div><p className="mt-4 font-display text-5xl">$10<span className="text-xl text-muted"> / month</span></p></div><div className="p-7"><h2 className="font-display text-3xl">Everything currently in Common Time.</h2><ul className="mt-6 space-y-3 text-sm leading-6 text-muted"><li>Lesson scheduling and rescheduling</li><li>Students, families, teachers, and places</li><li>Invoices, approvals, and Stripe payments</li><li>Notifications and family access</li></ul><p className="mt-7 border-t border-line pt-5 text-sm leading-6 text-muted">Add your card securely in Stripe. Nothing is charged today. Your first $10 payment is collected after the seven-day trial.</p></div></aside>
   <p className="text-[0.65rem] text-ink/60 lg:col-span-2 lg:justify-self-end">Photo by <a className="underline underline-offset-2" href="https://unsplash.com/@seemoris?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Caleb George</a> on <a className="underline underline-offset-2" href="https://unsplash.com/photos/grayscale-photo-of-people-holding-assorted-music-instruments-pH88tHG-1yw?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a></p>
  </div>
 </section>
 <section className="border-b border-line bg-canvas px-5 py-20 sm:px-8 sm:py-28"><div className="mx-auto max-w-6xl"><div className="max-w-3xl"><p className="text-xs uppercase tracking-[0.16em] text-brand">One workspace for the teaching week</p><h2 className="mt-4 font-display text-5xl leading-none tracking-[-0.035em] sm:text-6xl">Music school management software that starts with the lesson.</h2><p className="mt-6 text-base leading-7 text-muted">Common Time connects the date and time of each lesson to the people, policies, rescheduling decisions, invoices, and payments around it. It works for a solo private music teacher and can grow into a multi-teacher school.</p></div><div className="mt-12 grid gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-3"><article className="bg-surface p-7"><h3 className="font-display text-3xl">Lesson scheduling</h3><p className="mt-4 text-sm leading-6 text-muted">Create recurring or one-time lessons, find openings, track teaching availability, and reschedule one occurrence without breaking the series.</p></article><article className="bg-surface p-7"><h3 className="font-display text-3xl">Invoices and payments</h3><p className="mt-4 text-sm leading-6 text-muted">Prepare lesson invoices, request payer approval, collect cards through Stripe, or record payments received outside the app.</p></article><article className="bg-surface p-7"><h3 className="font-display text-3xl">Students and families</h3><p className="mt-4 text-sm leading-6 text-muted">Keep students, payers, teachers, lesson history, and outstanding schedule decisions connected and easy to find.</p></article></div></div></section>
 <section className="relative overflow-hidden border-y border-line bg-surface px-5 py-20 sm:px-8 sm:py-28"><div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/10 blur-3xl"/><div className="relative mx-auto max-w-6xl">
  <div className="text-center"><h2 className="font-display text-[clamp(2rem,5.2vw,4.5rem)] leading-none tracking-[-0.035em] sm:whitespace-nowrap">We’re only on beat 1, measure 1, here…</h2><p className="mx-auto mt-7 max-w-3xl text-base leading-7 text-muted">Common Time is about keeping the moving parts of a school together—schedules, teaching, communication, and payments—so the work stays clear and steady. Opus One schools help us decide what should come next as that system grows.</p></div>
  <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{coming.map((item,index)=><article key={item.title} className={`${item.accent?"border-brand/30 bg-brand/5":"border-line bg-canvas/70"} group rounded-card border p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg ${index===0?"lg:col-span-2":""}`}><div className="flex items-center justify-between gap-3"><span className="text-[0.65rem] uppercase tracking-[0.14em] text-brand">{item.label}</span><span className="font-display text-2xl text-line transition group-hover:text-brand/50">0{index+1}</span></div><h3 className="mt-8 font-display text-3xl">{item.title}</h3><p className="mt-3 text-sm leading-6 text-muted">{item.text}</p></article>)}</div>
 </div></section>
 <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-10 text-sm text-muted sm:px-8"><p>Common Time · made for the rhythm of teaching</p><a href={trialHref} className="text-brand hover:underline">Join Opus One →</a></footer>
 </main>}
