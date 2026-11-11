"use server";

import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {protectServerAction,RequestBoundaryError} from "@/lib/security/request-boundary";
import {sendPushToProfile} from "@/lib/push/server";

export type PushActionState={ok:boolean;message:string};
type SerializedSubscription={endpoint:string;keys:{p256dh:string;auth:string}};

async function actorForSchool(schoolId:string){
 const supabase=await createClient(),{data:auth}=await supabase.auth.getClaims(),profileId=auth?.claims?.sub;
 if(!profileId)return null;
 const{data:membership}=await supabase.from("school_members").select("profile_id").eq("school_id",schoolId).eq("profile_id",profileId).eq("status","active").maybeSingle();
 return membership?{supabase,profileId}:null;
}

export async function savePushSubscription(schoolId:string,subscription:SerializedSubscription,userAgent:string):Promise<PushActionState>{
 if(!/^[0-9a-f-]{36}$/i.test(schoolId)||!subscription?.endpoint?.startsWith("https://")||!subscription.keys?.p256dh||!subscription.keys?.auth)return{ok:false,message:"That browser subscription was incomplete."};
 const actor=await actorForSchool(schoolId);if(!actor)return{ok:false,message:"Sign in to enable browser notifications."};
 const rpc=actor.supabase.rpc.bind(actor.supabase) as unknown as(name:string,args:Record<string,unknown>)=>Promise<{error:{code?:string}|null}>;
 const{error}=await rpc("save_my_push_subscription",{p_school_id:schoolId,p_endpoint:subscription.endpoint,p_p256dh_key:subscription.keys.p256dh,p_auth_key:subscription.keys.auth,p_user_agent:userAgent.slice(0,500)});
 if(error)return{ok:false,message:"The browser subscription could not be saved."};
 revalidatePath(`/schools/${schoolId}/notification-settings`);
 return{ok:true,message:"Browser notifications are enabled on this device."};
}

export async function revokePushSubscription(endpoint:string):Promise<PushActionState>{
 if(!endpoint.startsWith("https://"))return{ok:false,message:"That browser subscription was invalid."};
 const supabase=await createClient(),rpc=supabase.rpc.bind(supabase) as unknown as(name:string,args:Record<string,unknown>)=>Promise<{error:{code?:string}|null}>;
 const{error}=await rpc("revoke_my_push_subscription",{p_endpoint:endpoint});
 return error?{ok:false,message:"The browser subscription could not be removed."}:{ok:true,message:"Browser notifications are off on this device."};
}

export async function saveNotificationPreferences(schoolId:string,preferences:{browserPushEnabled:boolean;billingActivity:boolean;scheduleRequests:boolean;lessonUpdates:boolean;dailyHello:boolean}):Promise<PushActionState>{
 const actor=await actorForSchool(schoolId);if(!actor)return{ok:false,message:"Sign in to change notification settings."};
 const rpc=actor.supabase.rpc.bind(actor.supabase) as unknown as(name:string,args:Record<string,unknown>)=>Promise<{error:{code?:string}|null}>;
 const{error}=await rpc("set_my_school_notification_preferences",{p_school_id:schoolId,p_browser_push_enabled:preferences.browserPushEnabled,p_billing_activity:preferences.billingActivity,p_schedule_requests:preferences.scheduleRequests,p_lesson_updates:preferences.lessonUpdates,p_daily_hello:preferences.dailyHello});
 if(error)return{ok:false,message:"Notification choices could not be saved."};
 revalidatePath(`/schools/${schoolId}/notification-settings`);
 return{ok:true,message:"Notification choices saved."};
}

export async function sendTestPush(schoolId:string):Promise<PushActionState>{
 const actor=await actorForSchool(schoolId);if(!actor)return{ok:false,message:"Sign in to test browser notifications."};
 try{await protectServerAction({scope:"push.notification.test",subject:`actor:${actor.profileId}|school:${schoolId}`,limit:5,windowSeconds:3600});}
 catch(caught){return{ok:false,message:caught instanceof RequestBoundaryError&&caught.code==="rate_limited"?"Test limit reached. Try again later.":"The test could not be validated."};}
 try{
  const delivered=await sendPushToProfile(actor.profileId,{title:"Common Time is ready",body:"Browser notifications are working on this device.",url:`/schools/${schoolId}/notification-settings`,tag:"common-time-push-test"});
  return delivered?{ok:true,message:`Test sent to ${delivered} active device${delivered===1?"":"s"}.`}:{ok:false,message:"No active browser subscription was found."};
 }catch(caught){console.error("Push test failed",{schoolId,name:caught instanceof Error?caught.name:"unknown"});return{ok:false,message:"The test notification could not be sent."};}
}
