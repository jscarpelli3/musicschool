"use client";
import {useActionState,useState} from "react";
import {issueSchoolInvitation,type InviteSchoolState} from "./actions";
const initial:InviteSchoolState={ok:false,message:""};
export function InviteSchoolForm(){const[state,action,pending]=useActionState(issueSchoolInvitation,initial),[copied,setCopied]=useState(false);return <form action={action} className="mt-6 grid gap-4 border-y border-line py-6 sm:grid-cols-2">
 <label className="text-sm"><span className="mb-2 block text-muted">Beta tester email</span><input required name="email" type="email" autoComplete="email" className="w-full rounded-control border border-line bg-surface px-4 py-3"/></label>
 <label className="text-sm"><span className="mb-2 block text-muted">School name <span className="text-xs">(optional)</span></span><input name="school_name" autoComplete="organization" maxLength={120} className="w-full rounded-control border border-line bg-surface px-4 py-3"/></label>
 <div className="sm:col-span-2 flex flex-wrap items-center gap-4"><button disabled={pending} className="rounded-control bg-ink px-5 py-3 text-sm text-canvas disabled:opacity-50">{pending?"Creating secure link…":"Create onboarding link"}</button>{state.message?<p role="status" className={`text-sm ${state.ok?"text-muted":"text-danger"}`}>{state.message}</p>:null}</div>
 {state.inviteUrl?<div className="sm:col-span-2 rounded-control bg-surface p-4"><p className="break-all text-xs text-muted">{state.inviteUrl}</p><button type="button" className="mt-3 border-b border-brand text-sm text-brand" onClick={async()=>{await navigator.clipboard.writeText(state.inviteUrl!);setCopied(true)}}>{copied?"Copied":"Copy private link"}</button></div>:null}
 </form>}
