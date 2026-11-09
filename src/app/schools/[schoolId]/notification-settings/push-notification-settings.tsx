"use client";

import {useEffect,useState} from "react";
import {revokePushSubscription,saveNotificationPreferences,savePushSubscription,sendTestPush,type PushActionState} from "./actions";

type Preferences={browserPushEnabled:boolean;billingActivity:boolean;scheduleRequests:boolean;lessonUpdates:boolean};
type BrowserPermission="default"|"denied"|"granted"|"unsupported";

function applicationKey(value:string){
 const padding="=".repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");
 return Uint8Array.from(atob(base64),(character)=>character.charCodeAt(0));
}

export function PushNotificationSettings({schoolId,vapidPublicKey,initial}:{schoolId:string;vapidPublicKey:string;initial:Preferences}){
 const[preferences,setPreferences]=useState(initial),[permission,setPermission]=useState<BrowserPermission>("default"),[subscribed,setSubscribed]=useState(false),[busy,setBusy]=useState(false),[state,setState]=useState<PushActionState>({ok:false,message:""});
 useEffect(()=>{
  if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){queueMicrotask(()=>setPermission("unsupported"));return;}
  queueMicrotask(()=>setPermission(Notification.permission));
  void navigator.serviceWorker.ready.then((registration)=>registration.pushManager.getSubscription()).then((subscription)=>setSubscribed(Boolean(subscription)));
 },[]);
 async function enable(){
  setBusy(true);setState({ok:false,message:""});
  try{
   if(!vapidPublicKey){setState({ok:false,message:"Browser notifications are not configured yet."});return;}
   const decision=await Notification.requestPermission();setPermission(decision);
   if(decision!=="granted"){setState({ok:false,message:decision==="denied"?"Notifications are blocked in this browser’s settings.":"Notification permission was not granted."});return;}
   const registration=await navigator.serviceWorker.ready;
   const subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(vapidPublicKey)});
   const serialized=subscription.toJSON(),result=await savePushSubscription(schoolId,{endpoint:subscription.endpoint,keys:{p256dh:serialized.keys?.p256dh??"",auth:serialized.keys?.auth??""}},navigator.userAgent);
   setState(result);if(result.ok){setSubscribed(true);setPreferences((current)=>({...current,browserPushEnabled:true}));}
  }catch(caught){console.error("Push subscription failed",{name:caught instanceof Error?caught.name:"unknown"});setState({ok:false,message:"This browser could not enable notifications."});}
  finally{setBusy(false);}
 }
 async function disableDevice(){
  setBusy(true);setState({ok:false,message:""});
  try{const registration=await navigator.serviceWorker.ready,subscription=await registration.pushManager.getSubscription();if(subscription){await revokePushSubscription(subscription.endpoint);await subscription.unsubscribe();}setSubscribed(false);setState({ok:true,message:"Browser notifications are off on this device."});}
  catch{setState({ok:false,message:"This device could not be unsubscribed."});}
  finally{setBusy(false);}
 }
 async function save(){setBusy(true);setState(await saveNotificationPreferences(schoolId,preferences));setBusy(false);}
 async function test(){setBusy(true);setState(await sendTestPush(schoolId));setBusy(false);}
 const unavailable=permission==="unsupported";
 return <div className="grid gap-6">
  <section className="rounded-card border border-line bg-canvas/60 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-medium">This device</h3><p className="mt-2 max-w-xl text-sm leading-6 text-muted">Install Common Time and allow notifications to receive alerts even when the app is not open.</p></div><span className={`rounded-full px-3 py-1 text-xs ${subscribed?"bg-brand/10 text-brand":"bg-surface-raised text-muted"}`}>{subscribed?"Enabled":"Not enabled"}</span></div><div className="mt-5 flex flex-wrap gap-3">{subscribed?<><button type="button" disabled={busy} onClick={()=>void test()} className="rounded-control bg-ink px-4 py-2.5 text-sm text-canvas disabled:opacity-50">Send a test</button><button type="button" disabled={busy} onClick={()=>void disableDevice()} className="rounded-control border border-line px-4 py-2.5 text-sm text-muted disabled:opacity-50">Turn off on this device</button></>:<button type="button" disabled={busy||unavailable} onClick={()=>void enable()} className="rounded-control bg-ink px-4 py-2.5 text-sm text-canvas disabled:opacity-50">{busy?"Enabling…":"Enable on this device"}</button>}</div>{permission==="denied"?<p className="mt-4 text-xs leading-5 text-danger">This browser has blocked notifications. Open its site settings to allow them.</p>:unavailable?<p className="mt-4 text-xs leading-5 text-muted">Push notifications are not supported by this browser. On iPhone or iPad, install Common Time to the Home Screen first.</p>:null}</section>
  <section className="rounded-card border border-line bg-canvas/60 p-5"><h3 className="font-medium">What should reach you?</h3><p className="mt-2 text-sm leading-6 text-muted">These choices belong to your account at this school. In-app notifications remain available as a durable record.</p><div className="mt-5 grid gap-4"><Preference checked={preferences.browserPushEnabled} set={(value)=>setPreferences((current)=>({...current,browserPushEnabled:value}))} title="Browser push notifications" detail="Allow selected alerts to appear on your subscribed devices."/><Preference checked={preferences.billingActivity} set={(value)=>setPreferences((current)=>({...current,billingActivity:value}))} title="Billing activity" detail="Invoice approvals, review requests, and payment failures."/><Preference checked={preferences.scheduleRequests} set={(value)=>setPreferences((current)=>({...current,scheduleRequests:value}))} title="Schedule requests" detail="Cancellation, reschedule, and teacher proposal activity."/><Preference checked={preferences.lessonUpdates} set={(value)=>setPreferences((current)=>({...current,lessonUpdates:value}))} title="Lesson updates" detail="Lessons created or changed for you."/></div><button type="button" disabled={busy} onClick={()=>void save()} className="mt-6 rounded-control bg-brand px-4 py-2.5 text-sm text-surface disabled:opacity-50">{busy?"Saving…":"Save notification choices"}</button></section>
  {state.message?<p role="status" className={`text-sm ${state.ok?"text-brand":"text-danger"}`}>{state.message}</p>:null}
 </div>;
}

function Preference({checked,set,title,detail}:{checked:boolean;set:(value:boolean)=>void;title:string;detail:string}){return <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={checked} onChange={(event)=>set(event.target.checked)} className="mt-1 size-4 accent-[var(--school-accent)]"/><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-5 text-muted">{detail}</span></span></label>}
