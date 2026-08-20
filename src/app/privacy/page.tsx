import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy Policy · Common Time" };

export default function PrivacyPage() {
  return <PolicyPage title="Privacy Policy" updated="August 9, 2026">
    <p>Common Time provides scheduling, billing, and communication tools for music schools. This policy explains how Common Time handles information submitted through its transactional SMS program.</p>
    <h2>Information we collect</h2><p>We collect the name, mobile number, music-school name, consent language and version, consent source, and timestamps needed to operate and document the messaging program. We also receive message delivery, opt-out, and help-request events from our messaging provider.</p>
    <h2>How we use information</h2><p>We use this information to deliver requested scheduling notices, billing-approval links, payment updates, reminders, secure account links, and compliance responses. We do not use transactional SMS consent for unrelated marketing.</p>
    <h2>Sharing and processors</h2><p>Service providers such as communications, hosting, database, and payment processors may process information only to provide Common Time services. We do not sell mobile numbers or SMS consent data. All the above categories exclude text messaging originator opt-in data and consent; this information won’t be shared with any third parties.</p>
    <h2>Choices and retention</h2><p>Reply STOP to opt out or HELP for assistance. We retain consent and opt-out evidence as needed to honor preferences, resolve disputes, and meet legal and carrier requirements.</p>
    <h2>Questions</h2><p>Visit <Link href="/support">Common Time Support</Link> or contact the music school identified in your messages.</p>
  </PolicyPage>;
}

function PolicyPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-12 sm:px-8 sm:py-20"><p className="text-sm text-brand">Common Time</p><h1 className="mt-4 font-display text-5xl sm:text-7xl">{title}</h1><p className="mt-4 text-xs text-muted">Last updated {updated}</p><article className="policy-copy mt-10 space-y-6 border-t border-line pt-8 text-sm leading-7 text-muted">{children}</article></main>;
}
