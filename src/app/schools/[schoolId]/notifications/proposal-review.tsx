"use client";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { decideTeacherRescheduleProposal } from "./actions";

export function ProposalReview({schoolId,proposalId,status,student,teacher,original,proposed,reason}:{schoolId:string;proposalId:string;status:string;student:string;teacher:string;original:string;proposed:string;reason:string}){
 const pending=status==="pending_owner";
 return <section id="proposal-review" className="scroll-mt-28 border border-brand bg-brand/5 p-5 sm:p-8">
  <p className="text-xs uppercase tracking-[0.14em] text-brand">Teacher reschedule proposal</p><h2 className="mt-3 font-display text-4xl">Review the proposed time.</h2>
  <p className="mt-4 text-sm leading-6 text-muted">{student} remains at the original time unless you approve this proposal from {teacher}.</p>
  <div className="mt-7 grid gap-px bg-line sm:grid-cols-2"><div className="bg-canvas p-5"><p className="text-xs text-muted">Currently scheduled</p><p className="mt-2 text-sm">{original}</p></div><div className="bg-canvas p-5"><p className="text-xs text-muted">Proposed time</p><p className="mt-2 text-sm">{proposed}</p></div></div>
  <p className="mt-5 border-l-2 border-brand pl-4 text-sm"><span className="text-muted">Reason: </span>{reason}</p>
  {pending?<div className="mt-7 grid gap-4 sm:grid-cols-2"><HoldToConfirm action={()=>decideTeacherRescheduleProposal(schoolId,proposalId,"accept")} idleLabel="Hold to approve and move lesson" holdingLabel="Keep holding to approve…" submittingLabel="Checking schedule…" successLabel="Proposal approved" refreshOnSuccess/><HoldToConfirm action={()=>decideTeacherRescheduleProposal(schoolId,proposalId,"decline")} idleLabel="Hold to decline proposal" holdingLabel="Keep holding to decline…" submittingLabel="Declining…" successLabel="Proposal declined" refreshOnSuccess/></div>:<p className="mt-7 text-sm capitalize text-muted">This proposal is {status.replaceAll("_"," ")}.</p>}
 </section>;
}
