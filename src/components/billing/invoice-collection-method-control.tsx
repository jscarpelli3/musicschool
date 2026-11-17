"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setInvoiceCollectionMethod } from "@/app/schools/[schoolId]/families/[billingAccountId]/actions";

export function InvoiceCollectionMethodControl({schoolId,billingAccountId,billingPeriodId,value,onChanged}:{schoolId:string;billingAccountId:string;billingPeriodId:string;value:"stripe_or_outside"|"outside_only";onChanged?:()=>void}){
  const router=useRouter();
  const[pending,setPending]=useState(false);
  const[message,setMessage]=useState("");
  const change=async(next:"stripe_or_outside"|"outside_only")=>{
    setPending(true);setMessage("");
    const result=await setInvoiceCollectionMethod(schoolId,billingAccountId,billingPeriodId,next);
    setMessage(result.message);setPending(false);
    if(result.ok){router.refresh();onChanged?.();}
  };
  return <div className="mt-5 rounded-control border border-line bg-surface-raised p-4"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Collection method</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" disabled={pending||value==="stripe_or_outside"} onClick={()=>void change("stripe_or_outside")} className={`rounded-control border px-3 py-3 text-left text-sm ${value==="stripe_or_outside"?"border-brand bg-brand/10 text-brand":"border-line"}`}><strong className="block">Stripe or outside payment</strong><span className="mt-1 block text-xs leading-5 text-muted">Card collection remains available when Stripe is connected.</span></button><button type="button" disabled={pending||value==="outside_only"} onClick={()=>void change("outside_only")} className={`rounded-control border px-3 py-3 text-left text-sm ${value==="outside_only"?"border-brand bg-brand/10 text-brand":"border-line"}`}><strong className="block">Outside payment only</strong><span className="mt-1 block text-xs leading-5 text-muted">Common Time tracks the invoice without offering Stripe collection.</span></button></div>{pending?<p className="mt-3 text-xs text-muted">Saving collection method…</p>:message?<p role="status" className="mt-3 text-xs text-muted">{message}</p>:null}</div>;
}
