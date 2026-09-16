import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Help · Common Time" };

const sections = [
  { title: "For school owners", steps: [
    "Start on the Dashboard. Lessons that still need a time appear first, followed by the calendar, School overview, and invoice activity.",
    "Use Students, Families, and Staff to open a person's full record. Names throughout the workspace link back to those details.",
    "Choose New lesson to schedule a student. On the calendar, choose Add lesson before selecting an open time.",
    "Invoices are prepared per family. Review the itemized draft, lock the exact amount, then send it to the payer for approval.",
    "Approval is permission for one exact amount. It is not a completed payment or receipt.",
    "Use the gear beside the school name for school details, lesson types, spaces, policies, and appearance.",
  ] },
  { title: "For teachers", steps: [
    "Open My schedule to see assigned lessons, proposed times, weekly availability, and recent lessons.",
    "Open a lesson to record its outcome after it ends or to request a schedule change before it begins.",
    "A proposed change does not move the lesson until the required person approves it. The original time remains active while the proposal is pending.",
    "If the owner controls your availability, ask them to change it from your Staff record.",
  ] },
  { title: "For families and payers", steps: [
    "Open the Family portal and request a one-time code using the exact email your school has on file.",
    "The portal shows upcoming lessons, sent statements, payment status, calendar subscriptions, and any active automatic-payment permission.",
    "If an email seems suspicious, do not use its button. Open app.commontime.studio/portal yourself and compare the school, period, and amount.",
    "Common Time approval pages never ask you to type a card number. Contact the school named in the message if anything does not match.",
  ] },
];

export default function SupportPage() {
  return <main className="mx-auto min-h-screen max-w-4xl px-5 py-12 sm:px-8 sm:py-20">
    <p className="text-sm text-brand">Common Time</p><h1 className="mt-4 font-display text-5xl sm:text-7xl">How to use the app</h1>
    <p className="mt-5 max-w-2xl text-sm leading-7 text-muted">Choose the section that matches what you do. Common Time uses plain language in the app; unfamiliar terms include an explanation where they appear.</p>
    <div className="mt-10 grid gap-6">{sections.map((section) => <section key={section.title} className="ui-card p-6 sm:p-8"><h2 className="font-display text-3xl">{section.title}</h2><ul className="mt-5 grid gap-3 text-sm leading-6 text-muted">{section.steps.map((step) => <li key={step} className="rounded-control bg-surface p-4">{step}</li>)}</ul></section>)}</div>
    <section className="mt-10 rounded-card bg-ink p-6 text-canvas sm:p-8"><h2 className="font-display text-3xl">Need to verify a message?</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-canvas/75">Legitimate Common Time application links use <strong className="text-canvas">app.commontime.studio</strong>. Open the portal directly instead of following a link when you are unsure.</p><Link href="/portal" className="mt-5 inline-block rounded-control bg-canvas px-5 py-3 text-sm font-medium text-ink">Open the family portal</Link></section>
    <div className="mt-10 text-sm leading-7 text-muted"><p>For questions about a lesson, policy, statement, or charge, contact the music school named in the app or message. The school controls those records.</p><p className="mt-3">For text-message help, reply HELP. Reply STOP at any time to stop future messages.</p><p className="mt-4"><Link href="/sms-consent" className="hover:text-ink">SMS enrollment</Link> · <Link href="/terms" className="hover:text-ink">Terms</Link> · <Link href="/privacy" className="hover:text-ink">Privacy</Link></p></div>
  </main>;
}
