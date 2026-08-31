"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PendingActionStatus } from "@/components/ui/pending-action-status";

export function AppSignOut({label="Sign out",destination="/login",className="rounded-control border border-line px-4 py-control text-sm text-muted transition hover:border-brand hover:text-ink"}:{label?:string;destination?:string;className?:string}){
 const [pending,setPending]=useState(false),[error,setError]=useState("");
 async function signOut(){if(pending)return;setPending(true);setError("");try{const result=await Promise.race([createClient().auth.signOut({scope:"local"}),new Promise<never>((_,reject)=>window.setTimeout(()=>reject(new Error("sign_out_timeout")),10000))]);if(result.error)throw result.error;window.location.replace(destination);}catch{setPending(false);setError("Sign out did not finish. Please try again.");}}
 return <div><button type="button" onClick={signOut} disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`}>{pending?"Signing out…":label}</button><PendingActionStatus pending={pending} label="Ending this browser session…"/><p role="alert" className="mt-2 text-xs text-danger">{error}</p></div>;
}
