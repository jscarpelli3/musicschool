"use client";

import { useEffect,useState } from "react";

export function PendingActionStatus({pending,label,slowLabel="This is taking longer than usual. We are still working—do not submit again."}:{pending:boolean;label:string;slowLabel?:string}){
 if(!pending)return null;
 return <ActivePendingStatus label={label} slowLabel={slowLabel}/>;
}

function ActivePendingStatus({label,slowLabel}:{label:string;slowLabel:string}){
 const [slow,setSlow]=useState(false);
 useEffect(()=>{const timer=window.setTimeout(()=>setSlow(true),1800);return()=>window.clearTimeout(timer);},[]);
 return <div role="status" aria-live="polite" className="mt-3 flex items-start gap-3 text-sm text-muted"><span aria-hidden="true" className="relative mt-0.5 block h-4 w-4 shrink-0 animate-spin"><span className="absolute left-[7px] top-0 h-4 w-px rotate-45 bg-brand"/><span className="absolute left-[7px] top-0 h-4 w-px -rotate-45 bg-brand"/></span><span>{slow?slowLabel:label}</span></div>;
}
