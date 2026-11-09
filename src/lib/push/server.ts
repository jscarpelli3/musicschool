import "server-only";

import * as webpush from "web-push";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createAdminClient} from "@/lib/supabase/admin";

type PushSubscriptionRow={id:string;endpoint:string;p256dh_key:string;auth_key:string};

function configureWebPush(){
 const publicKey=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim(),privateKey=process.env.VAPID_PRIVATE_KEY?.trim();
 if(!publicKey||!privateKey)throw new Error("Web push is not configured.");
 webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim()||"mailto:support@commontime.studio",publicKey,privateKey);
}

export async function sendPushToProfile(profileId:string,payload:{title:string;body:string;url:string;tag:string}){
 configureWebPush();
 const admin=createAdminClient() as unknown as SupabaseClient;
 const{data,error}=await admin.from("user_push_subscriptions").select("id,endpoint,p256dh_key,auth_key").eq("profile_id",profileId).eq("status","active");
 if(error)throw new Error("Push subscriptions could not be loaded.");
 let delivered=0;
 for(const row of (data??[]) as PushSubscriptionRow[]){
  try{
   await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh_key,auth:row.auth_key}},JSON.stringify(payload),{TTL:300,urgency:"normal",topic:payload.tag});
   delivered+=1;
   await admin.from("user_push_subscriptions").update({last_used_at:new Date().toISOString()}).eq("id",row.id);
  }catch(caught){
   const status=typeof caught==="object"&&caught&&"statusCode" in caught?Number(caught.statusCode):0;
   if(status===404||status===410)await admin.from("user_push_subscriptions").update({status:"expired"}).eq("id",row.id);
   else throw caught;
  }
 }
 return delivered;
}
