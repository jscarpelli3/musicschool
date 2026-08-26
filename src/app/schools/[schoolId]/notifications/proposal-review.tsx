"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { decideTeacherRescheduleProposal } from "./actions";

export function ProposalReview({schoolId,proposalId,status,student,teacher,original,proposed,reason,closeHref=`/schools/${schoolId}/notifications`}:{schoolId:string;proposalId:string;status:string;student:string;teacher:string;original:string;proposed:string;reason:string;closeHref?:string}){
 const router=useRouter();
 useEffect(()=>{const previous=document.body.style.overflow;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")router.push(closeHref);};document.body.style.overflow="hidden";window.addEventListener("keydown",close);return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close);};},[router,closeHref]);
 const pending=status==="pending_owner";
 return <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="proposal-review-title">
  <Link href={closeHref} aria-label="Close proposal review" className="fixed inset-0 bg-[var(--ui-overlay)]" />
  <section id="proposal-review" className="fixed left-1/2 top-1/2 z-[101] max-h-[calc(100dvh-2rem)] w-[min(46rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-brand bg-canvas p-5 shadow-xl sm:p-8">
  <div className="flex items-start justify-between gap-5"><div><p className="text-xs uppercase tracking-[0.14em] text-brand">Teacher reschedule proposal</p><h2 id="proposal-review-title" className="mt-3 font-display text-4xl">Review the proposed time.</h2></div><Link href={closeHref} className="text-sm text-muted hover:text-ink">Close</Link></div>
  <p className="mt-4 text-sm leading-6 text-muted">{student} remains at the original time unless you approve this proposal from {teacher}.</p>
  <dl className="mt-7 grid gap-px bg-line sm:grid-cols-2"><div className="bg-canvas p-5"><dt className="text-xs text-muted">Teacher</dt><dd className="mt-2 text-sm font-medium">{teacher}</dd></div><div className="bg-canvas p-5"><dt className="text-xs text-muted">Student</dt><dd className="mt-2 text-sm font-medium">{student}</dd></div></dl>
  <div className="mt-7 grid gap-px bg-line sm:grid-cols-2"><div className="bg-canvas p-5"><p className="text-xs text-muted">Currently scheduled</p><p className="mt-2 text-sm">{original}</p></div><div className="bg-canvas p-5"><p className="text-xs text-muted">Proposed time</p><p className="mt-2 text-sm">{proposed}</p></div></div>
  <p className="mt-5 border-l-2 border-brand pl-4 text-sm"><span className="text-muted">Reason: </span>{reason}</p>
  {pending?<div className="mt-7 grid gap-4 sm:grid-cols-2"><HoldToConfirm action={()=>decideTeacherRescheduleProposal(schoolId,proposalId,"accept")} idleLabel="Hold to approve and move lesson" holdingLabel="Keep holding to approve…" submittingLabel="Checking schedule…" successLabel="Proposal approved" refreshOnSuccess/><HoldToConfirm action={()=>decideTeacherRescheduleProposal(schoolId,proposalId,"decline")} idleLabel="Hold to decline proposal" holdingLabel="Keep holding to decline…" submittingLabel="Declining…" successLabel="Proposal declined" refreshOnSuccess/></div>:<p className="mt-7 text-sm capitalize text-muted">This proposal is {status.replaceAll("_"," ")}.</p>}
  </section>
 </div>;
}
