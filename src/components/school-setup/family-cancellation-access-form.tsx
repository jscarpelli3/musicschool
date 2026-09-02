"use client";
import {useActionState,useEffect,useState} from "react";
import type {CancellationPolicyState} from "@/app/schools/[schoolId]/policies/actions";
const initialState:CancellationPolicyState={ok:false,message:""};
const field="mt-2 w-full border-b border-line bg-transparent py-3 outline-none transition focus:border-brand";
export function FamilyCancellationAccessForm({initial,action}:{initial:{timelyApprovalMode:string;refundPortalMode:string};action:(previous:CancellationPolicyState,data:FormData)=>Promise<CancellationPolicyState>}){
 const [state,formAction,pending]=useActionState(action,initialState);
 const [timelyApprovalMode,setTimelyApprovalMode]=useState(initial.timelyApprovalMode);
 const [refundPortalMode,setRefundPortalMode]=useState(initial.refundPortalMode);
 useEffect(()=>{if(state.ok)window.dispatchEvent(new CustomEvent("common-time:toast",{detail:{title:"Family access updated",message:state.message}}));},[state]);
 return <form action={formAction} className="space-y-7">
  <label className="block"><span className="text-sm font-medium">Timely reschedules</span><span className="mt-1 block text-xs leading-5 text-muted">Automatically approved reschedules return the lesson to the unscheduled lesson pool. Account credits and refunds still require owner review.</span><select name="timely_approval_mode" value={timelyApprovalMode} onChange={(event)=>setTimelyApprovalMode(event.target.value)} className={field}><option value="owner_review">Owner review required</option><option value="automatic">Automatically approve within the notice window</option></select></label>
  <label className="block"><span className="text-sm font-medium">Refunds in the family portal</span><select name="refund_portal_mode" value={refundPortalMode} onChange={(event)=>setRefundPortalMode(event.target.value)} className={field}><option value="allow_request" disabled>Allow portal refund requests · activation pending refund workflow</option><option value="contact_school">Tell families refunds are handled directly</option><option value="not_offered">Refunds are not offered</option></select><span className="mt-2 block text-xs leading-5 text-muted">Refund requests never move money automatically. Owners make the final decision and Stripe refund execution remains a separate recorded action.</span></label>
  <div className="flex flex-wrap items-center gap-5"><button disabled={pending} className="border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">{pending?"Saving…":"Save family access"}</button>{state.message&&!state.ok?<p role="alert" className="text-sm text-danger">{state.message}</p>:null}</div>
 </form>;
}
