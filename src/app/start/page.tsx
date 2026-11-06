import Link from "next/link";
import Image from "next/image";
import {CommonTimeLogo} from "@/components/brand/common-time-logo";

export const metadata={title:"Start free · Common Time"};
const coming=[
 {title:"The Resource Commons",text:"A friendly school community for sharing teaching PDFs, useful links, studio resources, and practical ideas for running a school.",accent:true,label:"Community"},
 {title:"A fuller teacher portal",text:"Lesson notes, student context, follow-ups, and the everyday teaching record—built around the teacher’s own schedule.",accent:true,label:"Teaching"},
 {title:"SMS support",text:"Optional school-specific text reminders and timely updates, with proper consent and dedicated messaging setup.",accent:true,label:"Communication"},
 {title:"Prospects and waitlists",text:"Capture inquiries, organize a waitlist, and deliberately turn a prospect into an enrolled student without entering everything twice.",label:"Enrollment"},
 {title:"Substitutes and makeups",text:"Assign a substitute for one occurrence, schedule owed lessons, and handle irregular or ad-hoc teaching cleanly.",label:"Scheduling"},
 {title:"Workload and payroll reporting",text:"Understand who actually taught each lesson and turn that history into clearer workload and compensation reports.",label:"Reporting"},
 {title:"Friendlier imports",text:"Bring in students and families from CSV or Google Contacts, with calendar-assisted schedule imports planned after that.",label:"Getting started"},
];
const trialHref="/login?next=%2Fsetup%3Ftrial%3D1";

export default function StartPage(){return <main className="min-h-screen bg-canvas text-ink">
 <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8"><CommonTimeLogo className="w-44"/><Link href="/login" className="text-sm text-muted hover:text-brand">Log in</Link></header>
 <section className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
  <div><p className="text-xs uppercase tracking-[0.16em] text-brand">Built for independent music teachers</p><h1 className="mt-5 max-w-3xl font-display text-6xl leading-[0.95] tracking-[-0.04em] sm:text-7xl">More time teaching. Less time piecing it all together.</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-muted">Schedule lessons, keep families informed, prepare invoices, and collect payments from one calm workspace.</p><div className="mt-9 flex flex-wrap items-center gap-5"><Link href={trialHref} className="rounded-control bg-ink px-6 py-3 text-sm text-canvas">Start seven days free</Link><span className="text-sm text-muted">Card required · cancel anytime</span></div></div>
  <aside className="overflow-hidden rounded-card border border-line bg-surface"><div className="bg-brand/10 p-7"><div className="flex items-center justify-between gap-4"><p className="text-xs uppercase tracking-[0.14em] text-brand">Opus One</p><span className="rounded-full bg-surface px-3 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-brand">Founding plan</span></div><p className="mt-4 font-display text-5xl">$10<span className="text-xl text-muted"> / month</span></p></div><div className="p-7"><h2 className="font-display text-3xl">Everything currently in Common Time.</h2><ul className="mt-6 space-y-3 text-sm leading-6 text-muted"><li>Lesson scheduling and rescheduling</li><li>Students, families, teachers, and places</li><li>Invoices, approvals, and Stripe payments</li><li>Notifications and family access</li></ul><p className="mt-7 border-t border-line pt-5 text-sm leading-6 text-muted">Add your card securely in Stripe. Nothing is charged today. Your first $10 payment is collected after the seven-day trial.</p></div></aside>
 </section>
 <section className="mx-auto max-w-6xl px-5 pb-14 sm:px-8 sm:pb-24">
  <figure className="group relative aspect-[16/7] min-h-64 overflow-hidden rounded-card bg-ink">
   <Image src="/images/unsplash/music-ensemble.webp" alt="Musicians holding an assortment of instruments together" fill sizes="(min-width: 1152px) 72rem, 100vw" className="object-cover object-center transition duration-700 group-hover:scale-[1.015]"/>
   <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent"/>
   <figcaption className="absolute bottom-3 right-3 rounded-full bg-ink/70 px-3 py-1 text-[0.65rem] text-white backdrop-blur-sm">
    Photo by <a className="underline decoration-white/40 underline-offset-2 hover:decoration-white" href="https://unsplash.com/@seemoris?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Caleb George</a> on <a className="underline decoration-white/40 underline-offset-2 hover:decoration-white" href="https://unsplash.com/photos/grayscale-photo-of-people-holding-assorted-music-instruments-pH88tHG-1yw?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>
   </figcaption>
  </figure>
 </section>
 <section className="relative overflow-hidden border-y border-line bg-surface px-5 py-20 sm:px-8 sm:py-28"><div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand/10 blur-3xl"/><div className="relative mx-auto max-w-6xl">
  <div className="text-center"><h2 className="font-display text-[clamp(2rem,5.2vw,4.5rem)] leading-none tracking-[-0.035em] sm:whitespace-nowrap">We’re only on beat 1, measure 1, here…</h2><p className="mx-auto mt-7 max-w-3xl text-base leading-7 text-muted">Common Time is about keeping the moving parts of a school together—schedules, teaching, communication, and payments—so the work stays clear and steady. Opus One schools help us decide what should come next as that system grows.</p></div>
  <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{coming.map((item,index)=><article key={item.title} className={`${item.accent?"border-brand/30 bg-brand/5":"border-line bg-canvas/70"} group rounded-card border p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg ${index===0?"lg:col-span-2":""}`}><div className="flex items-center justify-between gap-3"><span className="text-[0.65rem] uppercase tracking-[0.14em] text-brand">{item.label}</span><span className="font-display text-2xl text-line transition group-hover:text-brand/50">0{index+1}</span></div><h3 className="mt-8 font-display text-3xl">{item.title}</h3><p className="mt-3 text-sm leading-6 text-muted">{item.text}</p></article>)}</div>
 </div></section>
 <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-10 text-sm text-muted sm:px-8"><p>Common Time · made for the rhythm of teaching</p><Link href={trialHref} className="text-brand hover:underline">Join Opus One →</Link></footer>
 </main>}
