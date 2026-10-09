import Link from "next/link";

export default function PaymentCompletePage() {
  return <main className="grid min-h-screen place-items-center px-6 py-16"><section className="w-full max-w-lg text-center"><p className="text-xs uppercase tracking-[0.14em] text-brand">Payment submitted</p><h1 className="mt-4 font-display text-5xl">Thank you.</h1><p className="mt-4 text-sm leading-6 text-muted">Stripe is confirming the payment with the school. You may close this page. The school can share the Stripe receipt after confirmation.</p><Link href="/" className="mt-7 inline-block text-sm text-brand">Common Time</Link></section></main>;
}
