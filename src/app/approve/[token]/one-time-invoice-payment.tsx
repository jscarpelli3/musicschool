"use client";

import { useState, useTransition } from "react";
import { MdCreditCard } from "react-icons/md";
import { beginOneTimeInvoicePayment } from "./actions";

export function OneTimeInvoicePayment({ token, amount }: { token: string; amount: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <section className="mt-6 rounded-card border border-brand/35 bg-surface-raised p-6 sm:p-7" aria-labelledby="one-time-payment-heading">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/10 text-xl text-brand"><MdCreditCard aria-hidden="true" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand">Pay this invoice now</p><h2 id="one-time-payment-heading" className="mt-1 font-display text-2xl">Use a card one time</h2></div></div>
    <p className="mt-4 max-w-xl text-sm leading-6 text-muted">Pay {amount} securely on Stripe. Common Time will not save this card for the school to charge later.</p>
    <button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await beginOneTimeInvoicePayment(token); setMessage(result.message); if (result.ok && result.url) window.location.assign(result.url); })} className="mt-5 inline-flex rounded-control bg-brand px-5 py-3 text-sm font-semibold text-canvas transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-50">{pending ? "Opening secure payment…" : `Pay ${amount} securely`}</button>
    {message ? <p role="status" className="mt-4 text-sm leading-6 text-muted">{message}</p> : null}
  </section>;
}
