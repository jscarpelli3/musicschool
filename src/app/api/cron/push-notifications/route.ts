import type {SupabaseClient} from "@supabase/supabase-js";
import {createAdminClient} from "@/lib/supabase/admin";
import {recordPlatformIncident} from "@/lib/monitoring/platform-incidents";
import {sendPushToProfile} from "@/lib/push/server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Delivery={id:string;profile_id:string;title:string;message:string;href:string};
type DailyHello={id:string;profile_id:string;school_id:string;school_name:string;school_timezone:string;local_date:string;member_role:string};

function localDate(iso:string,timeZone:string){const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(iso));const value=(type:string)=>parts.find((part)=>part.type===type)?.value??"";return`${value("year")}-${value("month")}-${value("day")}`;}

async function dailyHelloBody(admin:SupabaseClient,item:DailyHello){
 const from=new Date(Date.now()-18*60*60*1000).toISOString(),through=new Date(Date.now()+42*60*60*1000).toISOString();
 const{data:lessons,error}=await admin.from("lesson_events").select("teacher_id,starts_at,status").eq("school_id",item.school_id).gte("starts_at",from).lt("starts_at",through).neq("status","cancelled");
 if(error)throw error;
 const personal=!["owner","admin"].includes(item.member_role);let teacherId:string|null=null;
 if(personal){
  const person=await admin.from("people").select("id").eq("school_id",item.school_id).eq("profile_id",item.profile_id).eq("status","active").maybeSingle();
  if(person.error)throw person.error;teacherId=person.data?.id??null;
 }
 const count=(lessons??[]).filter((lesson)=>localDate(lesson.starts_at,item.school_timezone)===item.local_date&&(!personal||(teacherId!==null&&lesson.teacher_id===teacherId))).length;
 if(["owner","admin"].includes(item.member_role))return count?`${count} ${count===1?"lesson is":"lessons are"} on today’s calendar at ${item.school_name}.`:`The calendar is clear today at ${item.school_name}.`;
 return count?`You have ${count} ${count===1?"lesson":"lessons"} today at ${item.school_name}.`:`You have no lessons today at ${item.school_name}.`;
}

export async function GET(request:Request){
 const secret=process.env.PUSH_WORKER_SECRET?.trim();
 if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return new Response("Unauthorized",{status:401});
 const admin=createAdminClient() as unknown as SupabaseClient,[queue,daily]=await Promise.all([admin.rpc("claim_push_notification_deliveries",{p_limit:50}),admin.rpc("claim_daily_hello_push_deliveries",{p_limit:25})]);
 if(queue.error||daily.error){console.error("Push queue claim failed",{queueCode:queue.error?.code,dailyCode:daily.error?.code});return Response.json({ok:false,error:"claim_failed"},{status:500});}
 let delivered=0,failed=0;
 for(const item of (daily.data??[]) as DailyHello[]){
  try{
   const body=await dailyHelloBody(admin,item),devices=await sendPushToProfile(item.profile_id,{title:"Good morning.",body,url:["owner","admin"].includes(item.member_role)?`/schools/${item.school_id}?welcome=1`:`/schools/${item.school_id}/teacher`,tag:`daily-hello-${item.school_id}-${item.local_date}`});
   const completed=await admin.rpc("complete_daily_hello_push_delivery",{p_delivery_id:item.id,p_delivered:devices>0,p_error:devices?null:"no_active_subscriptions"});
   if(completed.error)throw completed.error;if(devices)delivered+=1;else failed+=1;
  }catch(caught){const message=caught instanceof Error?caught.message:"daily_hello_delivery_failed";await admin.rpc("complete_daily_hello_push_delivery",{p_delivery_id:item.id,p_delivered:false,p_error:message.slice(0,500)});failed+=1;}
 }
 for(const item of (queue.data??[]) as Delivery[]){
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
 const claimed=(queue.data??[]).length+(daily.data??[]).length;
 if(failed)await recordPlatformIncident({fingerprint:`push-delivery-worker:${new Date().toISOString().slice(0,10)}`,provider:"application",severity:"warning",title:"Browser push delivery needs attention",summary:"One or more queued browser notifications could not be delivered and will be retried.",sourceKind:"push_notification_worker",metadata:{failed,claimed}});
 return Response.json({ok:failed===0,claimed,dailyHello:(daily.data??[]).length,delivered,failed},{status:failed?207:200});
}
