"use client";
import { useActionState } from "react";
import { joinEarlyAccess,type EarlyAccessState } from "./actions";
const initial:EarlyAccessState={ok:false,message:""};
const field="w-full border-b border-line bg-transparent py-3 text-ink outline-none transition placeholder:text-muted/60 focus:border-brand";

export function EarlyAccessForm(){
 const [state,action,pending]=useActionState(joinEarlyAccess,initial);
 return <form action={action} className="mt-8 border-t border-line pt-6">
  <p className="text-xs uppercase tracking-[0.12em] text-brand">Early access</p>
  <div className="mt-5 grid gap-5"><label className="text-xs text-muted">Email address<input required name="email" type="email" autoComplete="email" maxLength={320} placeholder="you@yourmusicschool.com" className={field}/></label><details className="text-xs text-muted"><summary className="cursor-pointer transition hover:text-ink">Add your name and school <span className="opacity-60">(optional)</span></summary><div className="mt-4 grid gap-4"><label>Your name<input name="name" autoComplete="name" maxLength={160} className={field}/></label><label>Music school<input name="schoolName" autoComplete="organization" maxLength={160} className={field}/></label></div></details></div>
  <label className="absolute -left-[10000px]" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
  <p className="mt-5 text-[11px] leading-5 text-muted">By joining, you agree to receive occasional email about Common Time’s launch and early access. No transactional texts and no app account are created. You can unsubscribe anytime.</p>
  <button disabled={pending||state.ok} className="mt-5 w-full border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:cursor-wait disabled:opacity-60">{pending?"Joining…":state.ok?"You’re on the list":"Join the early-access list →"}</button>
  <p aria-live="polite" className={`mt-3 min-h-5 text-xs leading-5 ${state.message&&!state.ok?"text-danger":"text-muted"}`}>{state.message}</p>
 </form>;
}
