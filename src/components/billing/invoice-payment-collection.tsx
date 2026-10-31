"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MdCreditCard, MdOutlineAccountBalanceWallet } from "react-icons/md";
import { cancelOneTimeInvoicePaymentLink, collectFamilyInvoice, createOneTimeInvoicePaymentLink, loadPreparedInvoice, recordInvoiceSettlement, refundStripeInvoicePayment } from "@/app/schools/[schoolId]/families/[billingAccountId]/actions";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

const POLL_INTERVAL_MS = 3_000;
const POLL_WINDOW_MS = 2 * 60_000;

type Settlement = { id:string;entryType:string;method:string|null;amountCents:number;occurredAt:string;reference:string|null;note:string|null;sourceEntryId:string|null };

function localDateInputValue(date=new Date()) {
  const offsetDate=new Date(date.getTime()-date.getTimezoneOffset()*60_000);
  return offsetDate.toISOString().slice(0,10);
}

export function InvoicePaymentCollection({ schoolId, billingAccountId, billingPeriodId, amount, amountCents, currency, hasPaymentMethod, initialStatus, initialAttempt, initialSettlements=[], initialOutstandingCents=amountCents, stripePayments=[], stripeRefunds=[] }: {
  schoolId: string;
  billingAccountId: string;
  billingPeriodId: string;
  amount: string;
  amountCents: number;
  currency: string;
  hasPaymentMethod: boolean;
  initialStatus: string;
  initialAttempt: { id: string; status: string; failureMessage: string | null; usesSavedMethod: boolean; hostedLinkOpen: boolean } | null;
  initialSettlements?: Settlement[];
  initialOutstandingCents?: number;
  stripePayments?: Array<{id:string;amountCents:number;succeededAt:string|null}>;
  stripeRefunds?: Array<{id:string;paymentAttemptId:string;amountCents:number;status:string;reason:string|null}>;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [attempt, setAttempt] = useState(initialAttempt);
  const [watching, setWatching] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [settlements,setSettlements]=useState(initialSettlements);
  const [outstandingCents,setOutstandingCents]=useState(initialOutstandingCents);
  const [ledgerMode,setLedgerMode]=useState<"payment"|"writeoff"|"refund"|null>(null);
  const [ledgerPending,setLedgerPending]=useState(false);
  const [ledgerMessage,setLedgerMessage]=useState("");
  const deadline = useRef(0);

  async function checkPayment(startWindow = false) {
    const next = await loadPreparedInvoice(schoolId, billingAccountId, billingPeriodId);
    if (!next) {
      setResultMessage("Payment status could not be checked. Nothing was charged by this check.");
      return;
    }
    setStatus(next.status);
    setAttempt(next.latestPaymentAttempt);
    setSettlements(next.settlements);
    setOutstandingCents(next.outstandingCents);
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
    } else {
      setResultMessage("");
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

  async function copyPaymentLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      return copied;
    }
  }

  const hostedLinkOpen = Boolean(attempt?.hostedLinkOpen);
  const hasOutsideResolution = settlements.some((entry)=>["external_payment","write_off"].includes(entry.entryType)&&!settlements.some((other)=>other.entryType==="reversal"&&other.sourceEntryId===entry.id));
  const hasOutsidePayment=settlements.some((entry)=>entry.entryType==="external_payment"&&!settlements.some((other)=>other.entryType==="reversal"&&other.sourceEntryId===entry.id));
  const hasWriteOff=settlements.some((entry)=>entry.entryType==="write_off"&&!settlements.some((other)=>other.entryType==="reversal"&&other.sourceEntryId===entry.id));
  const hasRefund=settlements.some((entry)=>entry.entryType==="external_refund")||stripeRefunds.some((entry)=>["created","submitted","succeeded"].includes(entry.status));
  const active = !hostedLinkOpen && (["submitted", "processing"].includes(attempt?.status ?? "") || (attempt?.status === "created" && attempt.usesSavedMethod));
  const failed = status === "payment_failed" || ["failed", "requires_action", "cancelled"].includes(attempt?.status ?? "");
  const canCheckStripeStatus=hostedLinkOpen||active||["failed","requires_action"].includes(attempt?.status??"");
  const title = status === "paid" ? hasWriteOff ? "Balance resolved with a write-off" : hasOutsidePayment ? "Payment recorded outside Stripe" : "Paid"
    : hasOutsideResolution ? "Partially resolved — balance remains"
    : active ? "Payment submitted — awaiting confirmation"
      : failed ? "Payment failed — ready to retry"
        : hostedLinkOpen ? "One-time payment link ready"
        : "Approved — ready to collect";
  const detail = status === "paid" ? hasWriteOff ? "The invoice is closed, but the written-off amount is not recorded as money received." : hasOutsidePayment ? "The owner recorded money received outside Common Time. The audit history below shows how and when." : "Stripe confirmed this payment. No further collection action is needed."
    : hasOutsideResolution ? "A partial payment or write-off is recorded below. Finish the remaining balance outside Stripe, write it off, or reverse the entry before starting a full Stripe collection."
    : active ? `Stripe is processing ${amount}. Do not submit another charge while confirmation is pending.`
      : failed ? `The prior attempt did not collect ${amount}. Confirm the payer’s card details, send a fresh one-time link, or record another payment method below. Never retry until the payer expects another attempt.`
        : hostedLinkOpen ? `A secure payment page is ready for ${amount}. No payment has been submitted yet.`
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
            {hostedLinkOpen ? <p className="mt-4 text-xs font-medium text-muted">A one-time payment link is already open for this invoice. Use or resend that link before starting another collection method.</p>
              : hasOutsideResolution ? <p className="mt-4 text-xs font-medium text-muted">Part of this invoice was resolved outside Stripe. Finish the remaining balance below or reverse that entry before using the saved card.</p>
              : hasPaymentMethod ? <div className="mt-4"><HoldToConfirm action={() => collectFamilyInvoice(schoolId, billingAccountId, billingPeriodId)} idleLabel={failed ? "Hold to try the saved card again" : `Hold to charge ${amount}`} holdingLabel="Keep holding to submit one charge…" submittingLabel="Submitting securely…" successLabel="Payment submitted" onSuccess={() => void checkPayment(true)} /></div>
              : <p className="mt-4 text-xs font-medium text-muted">No active saved card is available.</p>}
          </div>
          <div className="rounded-control bg-surface-raised p-4">
            <p className="text-sm font-medium">Send a one-time payment link</p>
            <p className="mt-2 text-xs leading-5 text-muted">The payer enters a card securely in Stripe. It is not saved for future charges.</p>
            {hostedLinkOpen ? <button type="button" disabled={linkPending} onClick={async()=>{setLinkPending(true);const result=await cancelOneTimeInvoicePaymentLink(schoolId,billingAccountId,billingPeriodId);setLinkMessage(result.message);if(result.ok){setPaymentUrl("");setLinkCopied(false);await checkPayment();}setLinkPending(false);}} className="mt-4 rounded-control border border-danger/50 px-4 py-3 text-sm text-danger hover:bg-danger/10 disabled:opacity-50">{linkPending?"Cancelling…":"Cancel this payment link"}</button> : <button type="button" disabled={linkPending||hasOutsideResolution} onClick={async () => {
              setLinkPending(true);
              setLinkMessage("");
              const result = paymentUrl ? { ok: true as const, url: paymentUrl, message: "" } : await createOneTimeInvoicePaymentLink(schoolId, billingAccountId, billingPeriodId);
              if (result.ok && result.url) {
                setPaymentUrl(result.url);
                if (await copyPaymentLink(result.url)) {
                  setLinkCopied(true);
                  setLinkMessage("Copied. Send this link directly to the payer.");
                } else {
                  setLinkCopied(false);
                  setLinkMessage("Copy did not work in this browser. Select the link below and copy it manually.");
                }
              } else setLinkMessage(result.message);
              setLinkPending(false);
            }} className="mt-4 rounded-control border border-brand px-4 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-50">{linkPending ? "Preparing link…" : linkCopied ? "Copy link again" : "Copy one-time payment link"}</button>}
            {linkMessage ? <p role="status" className="mt-3 break-words text-sm font-medium leading-5 text-brand">{linkMessage}</p> : null}
            {paymentUrl ? <label className="mt-3 block"><span className="text-[11px] text-muted">One-time payment link</span><input aria-label="One-time payment link" readOnly value={paymentUrl} onFocus={(event) => event.currentTarget.select()} className="mt-1.5 w-full rounded-control border border-line bg-canvas px-3 py-2 text-xs text-ink outline-none focus:border-brand" /></label> : null}
          </div>
        </div> : null}

        {status !== "paid"&&canCheckStripeStatus ? <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void checkPayment(true)} className="text-xs font-medium text-brand underline-offset-4 hover:underline">Check payment status</button><p className="text-xs leading-5 text-muted">Automatic checking runs for two visible minutes, then pauses.</p></div> : null}
        {resultMessage ? <p role="status" className={`mt-4 rounded-control p-4 text-sm ${failed ? "bg-danger/10 text-danger" : "bg-surface-raised text-ink"}`}>{resultMessage}</p> : null}

        <div className="mt-6 border-t border-brand/20 pt-5">
          <div className="flex items-start gap-3"><MdOutlineAccountBalanceWallet aria-hidden className="mt-0.5 text-xl text-brand"/><div><p className="text-sm font-medium">Other ways this invoice can be resolved</p><p className="mt-1 text-xs leading-5 text-muted">Record money received elsewhere, write off a balance, or refund a prior payment. Every action stays separate from Stripe and leaves an audit entry.</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2">
            {outstandingCents>0?<><button type="button" onClick={()=>setLedgerMode("payment")} className="rounded-control bg-ink px-3 py-2 text-xs text-canvas">Record payment received elsewhere</button><button type="button" onClick={()=>setLedgerMode("writeoff")} className="rounded-control border border-line px-3 py-2 text-xs">Write off balance</button></>:null}
            {(settlements.some((entry)=>entry.entryType==="external_payment")||stripePayments.length)?<button type="button" onClick={()=>setLedgerMode("refund")} className="rounded-control border border-line px-3 py-2 text-xs">Record a refund</button>:null}
          </div>
          <p className="mt-3 text-sm"><span className="text-muted">Remaining balance:</span> <strong>{new Intl.NumberFormat("en-US",{style:"currency",currency}).format(outstandingCents/100)}</strong></p>
          {hasRefund?<p className="mt-1 max-w-2xl text-xs leading-5 text-muted">Refunds return part of a prior payment without reopening the invoice balance. If a payment was recorded by mistake, reverse that payment instead; a reversal restores the amount owed.</p>:null}
          {ledgerMode?<SettlementForm mode={ledgerMode} outstandingCents={outstandingCents} currency={currency} settlements={settlements} stripePayments={stripePayments} stripeRefunds={stripeRefunds} pending={ledgerPending} onCancel={()=>{setLedgerMode(null);setLedgerMessage("");}} onSubmit={async(input)=>{setLedgerPending(true);setLedgerMessage("");const result=input.stripeAttemptId?await refundStripeInvoicePayment(schoolId,billingAccountId,billingPeriodId,input.stripeAttemptId,input.amountCents,input.note):await recordInvoiceSettlement(schoolId,billingAccountId,billingPeriodId,{type:input.type,method:input.method,amountCents:input.amountCents,occurredAt:input.occurredAt,reference:input.reference,note:input.note,sourceEntryId:input.sourceEntryId});setLedgerMessage(result.message);if(result.ok){setLedgerMode(null);await checkPayment();router.refresh();}setLedgerPending(false);}}/>:null}
          {ledgerMessage?<p role="status" className="mt-3 rounded-control bg-surface-raised p-3 text-sm">{ledgerMessage}</p>:null}
          {settlements.length||stripeRefunds.length?<div className="mt-4 space-y-2">{settlements.map((entry)=>{const reversed=settlements.some((other)=>other.entryType==="reversal"&&other.sourceEntryId===entry.id);return <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-raised px-3 py-2 text-xs"><span className={reversed?"line-through opacity-60":""}>{entry.entryType.replaceAll("_"," ")} · {new Date(entry.occurredAt).toLocaleDateString()}{entry.method?` · ${entry.method.replaceAll("_"," ")}`:""}</span><span className="flex items-center gap-3"><strong>{new Intl.NumberFormat("en-US",{style:"currency",currency}).format(entry.amountCents/100)}</strong>{!reversed&&["external_payment","write_off"].includes(entry.entryType)?<button type="button" disabled={ledgerPending} onClick={async()=>{setLedgerPending(true);const result=await recordInvoiceSettlement(schoolId,billingAccountId,billingPeriodId,{type:"reversal",amountCents:entry.amountCents,note:"Owner reversed the prior ledger entry.",sourceEntryId:entry.id});setLedgerMessage(result.message);if(result.ok){await checkPayment();router.refresh();}setLedgerPending(false);}} className="text-danger underline-offset-4 hover:underline">Reverse</button>:null}</span></div>;})}{stripeRefunds.map((entry)=><div key={entry.id} className="flex justify-between rounded-control bg-surface-raised px-3 py-2 text-xs"><span>Stripe refund · {entry.status}</span><strong>{new Intl.NumberFormat("en-US",{style:"currency",currency}).format(entry.amountCents/100)}</strong></div>)}</div>:null}
        </div>
      </div>
    </div>
  </section>;
}

function SettlementForm({mode,outstandingCents,currency,settlements,stripePayments,stripeRefunds,pending,onCancel,onSubmit}:{mode:"payment"|"writeoff"|"refund";outstandingCents:number;currency:string;settlements:Settlement[];stripePayments:Array<{id:string;amountCents:number;succeededAt:string|null}>;stripeRefunds:Array<{id:string;paymentAttemptId:string;amountCents:number;status:string;reason:string|null}>;pending:boolean;onCancel:()=>void;onSubmit:(input:{type:"external_payment"|"write_off"|"external_refund";method?:string;amountCents:number;occurredAt:string;reference:string;note:string;sourceEntryId?:string;stripeAttemptId?:string})=>Promise<void>}){
  const refundableExternal=settlements.filter((entry)=>entry.entryType==="external_payment"&&!settlements.some((other)=>other.entryType==="reversal"&&other.sourceEntryId===entry.id));
  const sources=[...refundableExternal.map((entry)=>({value:`external:${entry.id}`,label:`${entry.method?.replaceAll("_"," ")} payment — ${new Intl.NumberFormat("en-US",{style:"currency",currency}).format(entry.amountCents/100)}`,max:entry.amountCents-settlements.filter((refund)=>refund.entryType==="external_refund"&&refund.sourceEntryId===entry.id).reduce((sum,refund)=>sum+refund.amountCents,0)})),...stripePayments.map((entry)=>({value:`stripe:${entry.id}`,label:`Stripe payment — ${new Intl.NumberFormat("en-US",{style:"currency",currency}).format(entry.amountCents/100)}`,max:entry.amountCents-(stripeRefunds.filter((refund)=>refund.paymentAttemptId===entry.id&&["created","submitted","succeeded"].includes(refund.status)).reduce((sum,refund)=>sum+refund.amountCents,0))}))].filter((source)=>source.max>0);
  const [source,setSource]=useState(sources[0]?.value??"");
  const selected=sources.find((item)=>item.value===source);
  const [amountValue,setAmountValue]=useState(((mode==="refund"?selected?.max:outstandingCents)??0)/100+"");
  const [method,setMethod]=useState("cash");const[reference,setReference]=useState("");const[note,setNote]=useState("");const[date,setDate]=useState(localDateInputValue);
  const title=mode==="payment"?"Record payment received elsewhere":mode==="writeoff"?"Write off an unpaid balance":"Record a refund";
  return <form className="mt-4 rounded-card bg-surface-raised p-4" onSubmit={(event)=>{event.preventDefault();const amountCents=Math.round(Number(amountValue)*100);const [sourceKind,sourceId]=source.split(":");void onSubmit({type:mode==="payment"?"external_payment":mode==="writeoff"?"write_off":"external_refund",method:mode==="payment"?method:undefined,amountCents,occurredAt:`${date}T12:00:00`,reference,note,sourceEntryId:sourceKind==="external"?sourceId:undefined,stripeAttemptId:sourceKind==="stripe"?sourceId:undefined});}}><h4 className="font-medium">{title}</h4>{mode==="refund"?<><p className="mt-2 text-xs leading-5 text-muted">A refund returns money from the selected payment without increasing the remaining invoice balance. To correct a payment recorded by mistake, cancel and use Reverse on that payment instead.</p><label className="mt-3 block text-xs text-muted">Payment to refund<select value={source} onChange={(event)=>{setSource(event.target.value);const next=sources.find((item)=>item.value===event.target.value);if(next)setAmountValue((next.max/100).toFixed(2));}} className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink">{sources.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label></>:null}<div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted">Amount<input required inputMode="decimal" value={amountValue} onChange={(event)=>setAmountValue(event.target.value)} className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"/></label><label className="text-xs text-muted">Date<input required type="date" value={date} onChange={(event)=>setDate(event.target.value)} className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"/></label>{mode==="payment"?<label className="text-xs text-muted">Method<select value={method} onChange={(event)=>setMethod(event.target.value)} className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"><option value="cash">Cash</option><option value="check">Check</option><option value="venmo">Venmo</option><option value="zelle">Zelle</option><option value="bank_transfer">Bank transfer</option><option value="card_external">Card outside Common Time</option><option value="other">Other</option></select></label>:null}{mode==="payment"?<label className="text-xs text-muted">Reference · optional<input value={reference} onChange={(event)=>setReference(event.target.value)} placeholder="Check number or transaction ID" className="mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"/></label>:null}</div><label className="mt-3 block text-xs text-muted">{mode==="writeoff"||mode==="refund"?"Reason":"Note · optional"}<textarea required={mode!=="payment"} value={note} onChange={(event)=>setNote(event.target.value)} className="mt-1 min-h-20 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"/></label><div className="mt-3 flex gap-2"><button disabled={pending} className="rounded-control bg-ink px-4 py-2 text-sm text-canvas disabled:opacity-50">{pending?"Recording…":"Record with audit trail"}</button><button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-muted">Cancel</button></div></form>;
}
