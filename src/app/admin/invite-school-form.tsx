"use client";
import {useActionState,useState} from "react";
import {issueSchoolInvitation,type InviteSchoolState} from "./actions";
const initial:InviteSchoolState={ok:false,message:""};
export function InviteSchoolForm({email="",schoolName="",compact=false,hasPriorInvitation=false}:{email?:string;schoolName?:string;compact?:boolean;hasPriorInvitation?:boolean}){const[state,action,pending]=useActionState(issueSchoolInvitation,initial),[copied,setCopied]=useState(false);return <form action={action} className={compact?"grid gap-3":"mt-6 grid gap-4 border-y border-line py-6 sm:grid-cols-2"}>
 {compact?<><input type="hidden" name="email" value={email}/><input type="hidden" name="school_name" value={schoolName}/></>:<>
 <label className="text-sm"><span className="mb-2 block text-muted">Beta tester email</span><input required name="email" type="email" autoComplete="email" className="w-full rounded-control border border-line bg-surface px-4 py-3"/></label>
 <label className="text-sm"><span className="mb-2 block text-muted">School name <span className="text-xs">(optional)</span></span><input name="school_name" autoComplete="organization" maxLength={120} className="w-full rounded-control border border-line bg-surface px-4 py-3"/></label>
 </>}
 <div className={`${compact?"":"sm:col-span-2"} flex flex-wrap items-center gap-4`}><button disabled={pending} className="rounded-control bg-ink px-5 py-3 text-sm text-canvas disabled:opacity-50">{pending?`Sending to ${email||"recipient"}…`:hasPriorInvitation?"Send invitation again":"Send invitation"}</button>{state.message?<p role="status" className={`text-sm ${state.ok?"text-muted":"text-danger"}`}>{state.message}</p>:null}</div>
 {state.inviteUrl?<div className={`${compact?"":"sm:col-span-2"} rounded-control bg-surface p-4`}><p className="text-xs font-medium text-ink">Private link for {state.recipient}</p><p className="mt-2 break-all text-xs text-muted">{state.inviteUrl}</p><button type="button" className="mt-3 border-b border-brand text-sm text-brand" onClick={async()=>{await navigator.clipboard.writeText(state.inviteUrl!);setCopied(true)}}>{copied?"Copied":"Copy private link"}</button></div>:null}
 </form>}
