import type { Metadata } from "next";
import { SmsConsentForm } from "./sms-consent-form";

export const metadata: Metadata = { title: "SMS consent · Common Time", robots: { index: true, follow: true } };

export default async function SmsConsentPage({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  const { school = "" } = await searchParams;
  const defaultSchool = school.trim().slice(0, 160);
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-12 sm:px-8 sm:py-20">
      <header className="border-b border-line pb-8">
        <p className="text-sm text-brand">Common Time Transactional Messages</p>
        <h1 className="mt-4 max-w-2xl font-display text-5xl leading-[0.95] sm:text-7xl">Choose whether your school may text you.</h1>
        <p className="mt-6 max-w-2xl text-sm leading-6 text-muted">Enrollment is optional. Your music school can continue serving you even if you do not consent to text messages.</p>
      </header>
      <SmsConsentForm defaultSchool={defaultSchool} />
      <p className="mt-8 text-xs leading-5 text-muted">This form enrolls only the mobile number entered above. To withdraw consent at any time, reply STOP to any Common Time message.</p>
    </main>
  );
}
