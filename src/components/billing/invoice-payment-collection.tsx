"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MdCreditCard } from "react-icons/md";
import { collectFamilyInvoice, createOneTimeInvoicePaymentLink, loadPreparedInvoice } from "@/app/schools/[schoolId]/families/[billingAccountId]/actions";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

const POLL_INTERVAL_MS = 3_000;
const POLL_WINDOW_MS = 2 * 60_000;

export function InvoicePaymentCollection({ schoolId, billingAccountId, billingPeriodId, amount, hasPaymentMethod, initialStatus, initialAttempt }: {
  schoolId: string;
  billingAccountId: string;
  billingPeriodId: string;
  amount: string;
  hasPaymentMethod: boolean;
  initialStatus: string;
  initialAttempt: { id: string; status: string; failureMessage: string | null } | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [attempt, setAttempt] = useState(initialAttempt);
  const [watching, setWatching] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");
  const deadline = useRef(0);

  async function checkPayment(startWindow = false) {
    const next = await loadPreparedInvoice(schoolId, billingAccountId, billingPeriodId);
    if (!next) {
      setResultMessage("Payment status could not be checked. Nothing was charged by this check.");
      return;
    }
    setStatus(next.status);
    setAttempt(next.latestPaymentAttempt);
    if (next.status === "paid" || next.latestPaymentAttempt?.status === "succeeded") {
      setResultMessage("Payment confirmed. This invoice is paid.");
      setWatching(false);
      router.refresh();
      return;
    }
    if (["failed", "requires_action", "cancelled"].includes(next.latestPaymentAttempt?.status ?? "")) {
      setResultMessage(next.latestPaymentAttempt?.failureMessage ? `Payment failed: ${next.latestPaymentAttempt.failureMessage}` : "Payment did not complete. No successful charge was recorded; review the payment method before trying again.");
      setWatching(false);
      router.refresh();
      return;
    }
    if (startWindow) {
      deadline.current = Date.now() + POLL_WINDOW_MS;
      setWatching(true);
      setResultMessage("Watching for Stripe’s confirmation…");
    }
  }

  useEffect(() => {
    if (!watching) return;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() >= deadline.current) {
        setWatching(false);
        setResultMessage("Automatic checking paused after two minutes. Use “Check payment status” whenever you want to look again.");
        return;
      }
      void checkPayment();
    };
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    check();
    return () => window.clearInterval(interval);
  // checkPayment intentionally reads only stable identifiers and local state setters.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watching, schoolId, billingAccountId, billingPeriodId]);

  const active = ["created", "submitted", "processing"].includes(attempt?.status ?? "");
  const failed = status === "payment_failed" || ["failed", "requires_action", "cancelled"].includes(attempt?.status ?? "");
  const title = status === "paid" ? "Paid"
    : active ? "Payment submitted — awaiting confirmation"
      : failed ? "Payment failed — ready to retry"
        : "Approved — ready to collect";
  const detail = status === "paid" ? "Stripe confirmed this payment. No further action is needed."
    : active ? `Stripe is processing ${amount}. Do not submit another charge while confirmation is pending.`
      : failed ? `The prior attempt did not collect ${amount}. The payer can retry the one-time link, or you can use the saved card after confirming it is current.`
        : `The payer approved this exact ${amount} invoice. Choose the saved card or send a one-time Stripe payment link.`;

  return <section className="mt-6 rounded-card border border-brand/30 bg-brand/5 p-5 sm:p-6">
    <div className="flex items-start gap-4">
      <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/10 text-2xl text-brand"><MdCreditCard /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-[0.14em] text-brand">Payment collection</p>
        <h3 className="mt-1 font-display text-2xl">{title}</h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{detail}</p>

        {status !== "paid" && !active ? <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-control bg-surface-raised p-4">
            <p className="text-sm font-medium">Charge the saved card</p>
            <p className="mt-2 text-xs leading-5 text-muted">Uses the family’s authorized default payment method.</p>
            {hasPaymentMethod ? <div className="mt-4"><HoldToConfirm action={() => collectFamilyInvoice(schoolId, billingAccountId, billingPeriodId)} idleLabel={failed ? "Hold to try the saved card again" : `Hold to charge ${amount}`} holdingLabel="Keep holding to submit one charge…" submittingLabel="Submitting securely…" successLabel="Payment submitted" onSuccess={() => void checkPayment(true)} /></div>
              : <p className="mt-4 text-xs font-medium text-muted">No active saved card is available.</p>}
          </div>
          <div className="rounded-control bg-surface-raised p-4">
            <p className="text-sm font-medium">Send a one-time payment link</p>
            <p className="mt-2 text-xs leading-5 text-muted">The payer enters a card securely in Stripe. It is not saved for future charges.</p>
            <button type="button" disabled={linkPending} onClick={async () => {
              setLinkPending(true);
              setLinkMessage("");
              const result = await createOneTimeInvoicePaymentLink(schoolId, billingAccountId, billingPeriodId);
              if (result.ok && result.url) {
                try {
                  await navigator.clipboard.writeText(result.url);
                  setLinkCopied(true);
                  setLinkMessage("Copied. Send this link directly to the payer.");
                } catch {
                  setLinkCopied(false);
                  setLinkMessage(`Copy this payment link: ${result.url}`);
                }
                await checkPayment(true);
              } else setLinkMessage(result.message);
              setLinkPending(false);
            }} className="mt-4 rounded-control border border-brand px-4 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">{linkPending ? "Preparing link…" : linkCopied ? "Copy link again" : "Copy one-time payment link"}</button>
            {linkMessage ? <p role="status" className="mt-3 break-words text-sm font-medium leading-5 text-brand">{linkMessage}</p> : null}
          </div>
        </div> : null}

        {status !== "paid" ? <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void checkPayment(true)} className="text-xs font-medium text-brand underline-offset-4 hover:underline">Check payment status</button><p className="text-xs leading-5 text-muted">Automatic checking runs for two visible minutes, then pauses.</p></div> : null}
        {resultMessage ? <p role="status" className={`mt-4 rounded-control p-4 text-sm ${failed ? "bg-danger/10 text-danger" : "bg-surface-raised text-ink"}`}>{resultMessage}</p> : null}
      </div>
    </div>
  </section>;
}
