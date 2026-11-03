"use client";

import { useState, useTransition } from "react";
import { MdCreditCard } from "react-icons/md";
import { beginOneTimeInvoicePayment } from "./actions";

export function OneTimeInvoicePayment({ token, amount }: { token: string; amount: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <section className="mt-5 border-t border-line px-1 pt-5" aria-labelledby="one-time-payment-heading">
    <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-base text-brand"><MdCreditCard aria-hidden="true" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Optional alternate card</p><h2 id="one-time-payment-heading" className="mt-1 text-base font-medium">Pay once with a different card</h2></div></div>
    <p className="mt-3 max-w-xl text-xs leading-5 text-muted">Use this only if the school does not have your card or you want to pay {amount} with another card. It will not be saved.</p>
    <button type="button" disabled={pending} onClick={() => startTransition(async () => { const result = await beginOneTimeInvoicePayment(token); setMessage(result.message); if (result.ok && result.url) window.location.assign(result.url); })} className="mt-4 inline-flex rounded-control border border-brand px-4 py-2 text-xs font-medium text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">{pending ? "Opening secure payment…" : `Use another card for ${amount}`}</button>
    {message ? <p role="status" className="mt-4 text-sm leading-6 text-muted">{message}</p> : null}
  </section>;
}
