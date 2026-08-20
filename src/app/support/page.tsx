import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Support · Common Time" };

export default function SupportPage() {
  return <main className="mx-auto min-h-screen max-w-2xl px-5 py-12 sm:px-8 sm:py-20"><p className="text-sm text-brand">Common Time</p><h1 className="mt-4 font-display text-5xl sm:text-7xl">Messaging support</h1><div className="mt-10 space-y-6 border-t border-line pt-8 text-sm leading-7 text-muted"><p>Reply HELP to a Common Time text for messaging assistance. Reply STOP at any time to stop future messages.</p><p>For questions about lessons or a charge, contact the music school named in the message. The school controls its schedules, policies, and billing details.</p><p><Link href="/sms-consent">Manage SMS enrollment</Link> · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link></p></div></main>;
}
