"use client";
import {useActionState} from "react";
import {submitSupportTicket,type SupportState} from "./actions";
const initial:SupportState={ok:false,message:""};
export function SupportForm({schools}:{schools:Array<{id:string;name:string}>}){
 const[state,action,pending]=useActionState(submitSupportTicket,initial);
 return <form action={action} className="mt-8 grid gap-6" encType="multipart/form-data">
  <label><span className="text-sm text-muted">What can we help with?</span><select name="category" className="mt-2 w-full rounded-control border border-line bg-surface px-4 py-3"><option value="problem">Something is not working</option><option value="question">I have a question</option><option value="idea">I have an idea</option><option value="billing">Common Time subscription or billing</option></select></label>
  {schools.length?<label><span className="text-sm text-muted">School <span className="text-xs">(optional)</span></span><select name="school_id" className="mt-2 w-full rounded-control border border-line bg-surface px-4 py-3"><option value="">General Common Time support</option>{schools.map(school=><option key={school.id} value={school.id}>{school.name}</option>)}</select></label>:null}
  <label><span className="text-sm text-muted">Subject</span><input required minLength={3} maxLength={120} name="subject" className="mt-2 w-full rounded-control border border-line bg-surface px-4 py-3" placeholder="A quick summary"/></label>
  <label><span className="text-sm text-muted">Notes</span><textarea required minLength={10} maxLength={5000} name="notes" rows={7} className="mt-2 w-full rounded-control border border-line bg-surface px-4 py-3" placeholder="What happened? What did you expect instead?"/></label>
  <label><span className="text-sm text-muted">Screenshots <span className="text-xs">(optional, up to 3)</span></span><input type="file" name="screenshots" accept="image/jpeg,image/png,image/webp" multiple className="mt-2 block w-full text-sm text-muted file:mr-4 file:rounded-control file:border-0 file:bg-brand/10 file:px-4 file:py-2 file:text-brand"/><span className="mt-2 block text-xs text-muted">JPG, PNG, or WebP · 5 MB each. Screenshots are stored privately.</span></label>
  <button disabled={pending} className="justify-self-start rounded-control bg-ink px-6 py-3 text-sm text-canvas disabled:opacity-50">{pending?"Submitting…":"Submit support ticket"}</button>
  {state.message?<p role="status" className={`text-sm ${state.ok?"text-brand":"text-danger"}`}>{state.message}{state.ticketId?` Reference ${state.ticketId.slice(0,8)}.`:""}</p>:null}
 </form>;
}
