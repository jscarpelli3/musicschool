"use client";

import { useState,useTransition } from "react";
import { previewLessonRequest,submitLessonRequest } from "@/app/portal/lesson-request-actions";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { PendingActionStatus } from "@/components/ui/pending-action-status";

type Kind="cancellation"|"reschedule";
type Preview=Awaited<ReturnType<typeof previewLessonRequest>> extends infer R?R extends {ok:true;preview:infer P}?P:never:never;

export function LessonRequestControls({lessonId,timeZone}:{lessonId:string;timeZone:string}){
 const [pending,startTransition]=useTransition();
 const [kind,setKind]=useState<Kind|null>(null),[preview,setPreview]=useState<Preview|null>(null),[receipt,setReceipt]=useState<{at:string}|null>(null),[message,setMessage]=useState("");
 function prepare(next:Kind){
  if(pending)return;
  setKind(next);setMessage("");
  startTransition(async()=>{try{const result=await previewLessonRequest(lessonId,next);if(!result.ok){setKind(null);setMessage(result.message);return;}setPreview(result.preview);}catch{setKind(null);setMessage("The policy check did not finish. Nothing was submitted; please try again.");}});
 }
 async function submit(){
  if(!kind||!preview)return{ok:false,message:"Prepare the request first."};
  const accounted=!["unaccounted","draft"].includes(preview.accounting_state),resolution=kind==="reschedule"?"reschedule":accounted?"lesson_credit":"cancel";
  try{const result=await submitLessonRequest(lessonId,kind,resolution);if(!result.ok)return result;setReceipt({at:result.requestedAt});setPreview(null);return{ok:true,message:"Request recorded."};}
  catch{return{ok:false,message:"The request did not finish. Nothing is assumed; reload once before trying again."};}
 }
 if(receipt)return <section className="mt-8 border-l-2 border-brand pl-5"><h3 className="font-display text-2xl">Request sent</h3><p className="mt-3 text-sm leading-6">Recorded {new Intl.DateTimeFormat("en-US",{timeZone,dateStyle:"long",timeStyle:"short"}).format(new Date(receipt.at))}.</p><p className="mt-2 text-sm leading-6 text-muted">This recorded time determines how the policy applies. The lesson remains scheduled until the school confirms a change.</p><p className="mt-3 text-xs text-muted">The school has been notified.</p></section>;
 return <section className="mt-8 border-t border-line pt-6"><h3 className="font-display text-2xl">Change this lesson</h3>{!preview?<div className="mt-5 grid gap-3"><button disabled={pending} onClick={()=>prepare("cancellation")} className="border border-line px-4 py-3 text-left text-sm transition hover:border-brand disabled:cursor-wait disabled:opacity-60">{pending&&kind==="cancellation"?"Checking cancellation policy…":"Request cancellation"}</button><button disabled={pending} onClick={()=>prepare("reschedule")} className="border border-line px-4 py-3 text-left text-sm transition hover:border-brand disabled:cursor-wait disabled:opacity-60">{pending&&kind==="reschedule"?"Checking reschedule policy…":"Request reschedule"}</button><PendingActionStatus pending={pending} label="Checking the lesson and school policy…" slowLabel="The policy check is taking longer than usual. Nothing has been submitted yet; keep this panel open."/></div>:<div className="mt-5 border-l-2 border-brand pl-5"><p className="text-sm font-medium">{preview.within_policy_window?"This request is within the policy window.":"This request is outside the policy window."}</p><p className="mt-3 text-sm leading-6 text-muted">The school requires {preview.cutoff_hours} hours’ notice. {preview.policy_guidance}</p>{!preview.within_policy_window&&preview.late_lesson_resolution==="count_as_serviced"?<p className="mt-3 text-sm leading-6 text-danger">If the school approves the cancellation, this lesson will normally be counted as serviced and will not be replaced.</p>:null}{!preview.within_policy_window&&preview.late_lesson_resolution==="retain_for_reschedule"?<p className="mt-3 text-sm leading-6 text-ink">The lesson normally remains available to reschedule{preview.replacement_window_days!==null?` within ${preview.replacement_window_days} days`:""}{preview.late_reschedule_fee_cents>0?`, with a ${new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(preview.late_reschedule_fee_cents/100)} late-change fee`:""}.</p>:null}<p className="mt-3 text-sm leading-6 text-muted">Your submission time will be recorded and remains authoritative even if the school responds later. The lesson stays scheduled until the school confirms the change. The owner may make an individual exception.</p><div className="mt-5"><HoldToConfirm action={submit} idleLabel={`Hold to send ${kind} request`} holdingLabel="Keep holding to send…" submittingLabel="Recording and notifying the school…" successLabel="Request sent"/><button disabled={pending} onClick={()=>{setPreview(null);setKind(null);}} className="mt-2 w-full px-4 py-3 text-sm text-muted">Back</button></div></div>}{message?<p role="alert" className="mt-4 border-l-2 border-danger pl-4 text-sm leading-6 text-danger">{message}</p>:null}</section>;
}
