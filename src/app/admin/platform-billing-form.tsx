"use client";

import {useActionState} from "react";
import {setSchoolPlatformBillingTerms,type PlatformBillingState} from "./actions";

const initial:PlatformBillingState={ok:false,message:""};

export function PlatformBillingForm({schoolId,complimentary}:{schoolId:string;complimentary:boolean}){
 const action=setSchoolPlatformBillingTerms.bind(null,schoolId),[state,formAction,pending]=useActionState(action,initial);
 if(complimentary)return <form action={formAction} className="mt-4 border-t border-line pt-4"><input type="hidden" name="terms" value="standard"/><button disabled={pending} className="text-sm text-danger underline underline-offset-4 disabled:opacity-50">{pending?"Ending waiver…":"End fee waiver"}</button>{state.message?<p role="status" className={`mt-2 text-xs ${state.ok?"text-brand":"text-danger"}`}>{state.message}</p>:null}</form>;
 return <details className="mt-4 border-t border-line pt-4"><summary className="cursor-pointer text-sm text-brand">Waive subscription fee</summary><form action={formAction} className="mt-4 grid gap-4"><input type="hidden" name="terms" value="complimentary"/><label><span className="text-xs text-muted">Internal reason</span><input required name="reason" maxLength={500} placeholder="Founding beta tester" className="mt-2 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm"/></label><label><span className="text-xs text-muted">Waive through <span className="text-[0.68rem]">(optional)</span></span><input name="ends_on" type="date" className="mt-2 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm"/><span className="mt-1 block text-[0.68rem] text-muted">Leave blank until you manually end it.</span></label><button disabled={pending} className="justify-self-start rounded-control bg-ink px-4 py-2 text-sm text-canvas disabled:opacity-50">{pending?"Saving waiver…":"Waive Main plan fee"}</button>{state.message?<p role="status" className={`text-xs ${state.ok?"text-brand":"text-danger"}`}>{state.message}</p>:null}</form></details>;
}
