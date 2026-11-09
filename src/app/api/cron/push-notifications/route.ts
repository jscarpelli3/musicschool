import type {SupabaseClient} from "@supabase/supabase-js";
import {createAdminClient} from "@/lib/supabase/admin";
import {recordPlatformIncident} from "@/lib/monitoring/platform-incidents";
import {sendPushToProfile} from "@/lib/push/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Delivery={id:string;profile_id:string;title:string;message:string;href:string};

export async function GET(request:Request){
 const secret=process.env.PUSH_WORKER_SECRET?.trim();
 if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return new Response("Unauthorized",{status:401});
 const admin=createAdminClient() as unknown as SupabaseClient,{data,error}=await admin.rpc("claim_push_notification_deliveries",{p_limit:50});
 if(error){console.error("Push queue claim failed",{code:error.code});return Response.json({ok:false,error:"claim_failed"},{status:500});}
 let delivered=0,failed=0;
 for(const item of (data??[]) as Delivery[]){
  try{
   const devices=await sendPushToProfile(item.profile_id,{title:item.title,body:item.message,url:item.href,tag:`common-time-${item.id}`});
   const completed=await admin.rpc("complete_push_notification_delivery",{p_delivery_id:item.id,p_delivered:devices>0,p_error:devices?null:"no_active_subscriptions"});
   if(completed.error)throw completed.error;
   if(devices)delivered+=1;else failed+=1;
  }catch(caught){
   const message=caught instanceof Error?caught.message:"push_delivery_failed";
   await admin.rpc("complete_push_notification_delivery",{p_delivery_id:item.id,p_delivered:false,p_error:message.slice(0,500)});
   failed+=1;
  }
 }
 if(failed)await recordPlatformIncident({fingerprint:`push-delivery-worker:${new Date().toISOString().slice(0,10)}`,provider:"application",severity:"warning",title:"Browser push delivery needs attention",summary:"One or more queued browser notifications could not be delivered and will be retried.",sourceKind:"push_notification_worker",metadata:{failed,claimed:(data??[]).length}});
 return Response.json({ok:failed===0,claimed:(data??[]).length,delivered,failed},{status:failed?207:200});
}
