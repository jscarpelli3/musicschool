import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "SMS Terms · MusicSchool" };

export default function TermsPage() {
  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
    <p className="text-sm text-brand">MusicSchool</p><h1 className="mt-4 font-display text-5xl sm:text-7xl">SMS Terms of Service</h1><p className="mt-4 text-xs text-muted">Last updated August 9, 2026</p>
    <article className="policy-copy mt-10 space-y-6 border-t border-line pt-8 text-sm leading-7 text-muted">
      <h2>Program</h2><p>By enrolling, you agree to receive recurring transactional text messages from MusicSchool and the music school you identify. Messages may concern lesson scheduling, billing approvals, payment status, reminders, and secure account access. This program does not enroll you in promotional marketing.</p>
      <h2>Frequency and charges</h2><p>Message frequency varies with lesson and billing activity. Message and data rates may apply under your mobile plan. Consent is not a condition of purchase.</p>
      <h2>Stopping or getting help</h2><p>Reply STOP to opt out. Reply HELP for help. You may also visit <Link href="/support">MusicSchool Support</Link> or contact the music school named in your messages.</p>
      <h2>Delivery</h2><p>Wireless carriers are not liable for delayed or undelivered messages. Delivery is subject to carrier availability and cannot be guaranteed.</p>
      <h2>Privacy</h2><p>Use of the SMS program is governed by the <Link href="/privacy">MusicSchool Privacy Policy</Link>. SMS consent is separate from payment authorization and other communication preferences.</p>
    </article>
  </main>;
}
