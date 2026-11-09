"use client";

import {useActionState} from "react";
import {changePlatformIncidentStatus,type PlatformIncidentState} from "./actions";

const initial:PlatformIncidentState={ok:false,message:""};

export function IncidentStatusControls({incidentId,status}:{incidentId:string;status:string}){
 const nextStatus=status==="open"?"acknowledged":status==="acknowledged"?"resolved":"open";
 const action=changePlatformIncidentStatus.bind(null,incidentId,nextStatus);
 const[state,formAction,pending]=useActionState(action,initial);
 return <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3">
  <button disabled={pending} className="rounded-control border border-line bg-canvas px-3 py-2 text-xs font-medium hover:border-brand disabled:opacity-50">{pending?"Updating…":nextStatus==="acknowledged"?"Acknowledge":nextStatus==="resolved"?"Mark resolved":"Reopen"}</button>
  {state.message?<span role="status" className={`text-xs ${state.ok?"text-brand":"text-danger"}`}>{state.message}</span>:null}
 </form>;
}
