import QRCode from "qrcode";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkSchoolCapability } from "@/lib/auth/school-capabilities";
import { createClient } from "@/lib/supabase/server";
import { beginLessonQuickPayment } from "./actions";
import { PaymentStatusRefresh } from "./payment-status-refresh";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  already_paid: "This lesson has already been paid separately.",
  billing_account: "Attach exactly one active billing account to this student before collecting.",
  price: "This lesson’s recorded price does not match an active Stripe price. Reconcile the offering first.",
  stripe: "Finish the school’s Stripe connection before collecting.",
  failed: "The payment request could not be opened. Nothing was charged.",
};

export default async function LessonPaymentPage({ params, searchParams }: {
  params: Promise<{ schoolId: string; lessonId: string }>;
  searchParams: Promise<{ request?: string; error?: string }>;
}) {
  const { schoolId, lessonId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=${encodeURIComponent(`/schools/${schoolId}/lessons/${lessonId}/payment`)}`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.billing.manage")) notFound();
  const [{ data: school }, { data: lesson }, { data: snapshot }] = await Promise.all([
    supabase.from("schools").select("name,timezone").eq("id", schoolId).maybeSingle(),
    supabase.from("lesson_events").select("id,student_id,starts_at,status").eq("school_id", schoolId).eq("id", lessonId).maybeSingle(),
    supabase.from("lesson_event_price_snapshots").select("offering_name,amount_cents,currency,billing_mode").eq("school_id", schoolId).eq("lesson_event_id", lessonId).maybeSingle(),
  ]);
  if (!school || !lesson || !snapshot) notFound();
  const { data: student } = await supabase.from("people").select("first_name,last_name,preferred_name").eq("school_id", schoolId).eq("id", lesson.student_id).maybeSingle();
  if (!student) notFound();
  const studentName = `${student.preferred_name || student.first_name} ${student.last_name}`;
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: snapshot.currency }).format(snapshot.amount_cents / 100);
  const lessonDate = new Intl.DateTimeFormat("en-US", { timeZone: school.timezone, weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(lesson.starts_at));
  const requestId = query.request && /^[0-9a-f-]{36}$/i.test(query.request) ? query.request : null;
  const { data: paymentRequest } = requestId ? await supabase.from("lesson_payment_requests").select("id,status,checkout_url,expires_at")
    .eq("school_id", schoolId).eq("lesson_event_id", lessonId).eq("id", requestId).maybeSingle() : { data: null };
  const renderedAt = Date.now(); // eslint-disable-line react-hooks/purity -- request-time expiry check in a force-dynamic Server Component
  const usableUrl = paymentRequest?.status === "open" && paymentRequest.checkout_url && new Date(paymentRequest.expires_at).getTime() > renderedAt ? paymentRequest.checkout_url : null;
  const qrDataUrl = usableUrl ? await QRCode.toDataURL(usableUrl, { width: 440, margin: 2, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }) : null;

  return <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 sm:px-8 sm:py-section">
    <Link href={`/schools/${schoolId}?lesson=${lessonId}`} className="text-sm text-muted hover:text-brand">← Back to lesson</Link>
    <header className="mt-8">
      <p className="text-xs uppercase tracking-[0.14em] text-brand">{school.name} · Quick payment</p>
      <h1 className="mt-3 font-display text-4xl sm:text-5xl">Collect {amount} for {studentName}’s lesson.</h1>
      <p className="mt-4 text-sm leading-6 text-muted">{snapshot.offering_name} · {lessonDate}</p>
    </header>

    {usableUrl && qrDataUrl ? <section className="ui-card mt-8 p-6 text-center sm:p-9">
      <p className="text-sm leading-6">Have the payer scan this code with their phone. Payment happens securely on Stripe, not inside Common Time.</p>
      {/* QR output is generated from the exact short-lived Stripe Checkout URL. */}
      <Image unoptimized width={440} height={440} src={qrDataUrl} alt="QR code opening this lesson’s secure Stripe payment page" className="mx-auto mt-6 w-full max-w-80 rounded-control bg-white p-3" />
      <a href={usableUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-control bg-brand px-5 py-3 text-sm text-canvas hover:bg-brand-hover">Open payment page</a>
      <PaymentStatusRefresh />
      <p className="mt-5 text-xs leading-5 text-muted">This code expires at {new Intl.DateTimeFormat("en-US", { timeZone: school.timezone, hour: "numeric", minute: "2-digit" }).format(new Date(paymentRequest!.expires_at))}. The lesson is marked paid only after Stripe confirms the payment.</p>
    </section> : paymentRequest?.status === "succeeded" ? <section className="ui-card mt-8 p-7"><p className="text-sm text-brand">Payment confirmed</p><h2 className="mt-2 font-display text-3xl">This lesson is paid separately.</h2><p className="mt-3 text-sm leading-6 text-muted">It will remain visible on the family statement and add $0 to the amount due. Open the payment in Stripe when you need its current receipt.</p></section> : <section className="ui-card mt-8 p-7 sm:p-9">
      <h2 className="font-display text-3xl">Create a secure payment code</h2>
      <p className="mt-3 text-sm leading-6 text-muted">The amount comes from the lesson’s recorded Stripe price and cannot be changed here. The code lasts 30 minutes.</p>
      {query.error ? <p role="alert" className="mt-5 rounded-control bg-danger/10 p-4 text-sm text-danger">{errors[query.error] ?? errors.failed}</p> : null}
      {snapshot.billing_mode === "per_session" && snapshot.amount_cents > 0 ? <form action={beginLessonQuickPayment.bind(null, schoolId, lessonId)}><button className="mt-6 rounded-control bg-brand px-5 py-3 text-sm text-canvas hover:bg-brand-hover">Create payment QR code</button></form> : <p className="mt-5 text-sm text-danger">Quick payment is available only for per-lesson pricing.</p>}
    </section>}
  </main>;
}
