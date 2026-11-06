"use server";

import {redirect} from "next/navigation";
import type {SupabaseClient} from "@supabase/supabase-js";
import {checkSchoolCapability} from "@/lib/auth/school-capabilities";
import {protectServerAction} from "@/lib/security/request-boundary";
import {getStripe,getStripeMode} from "@/lib/stripe/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";

const path=(schoolId:string,status?:string)=>`/schools/${schoolId}/subscription${status?`?status=${status}`:""}`;
function applicationUrl(){const value=process.env.APP_URL?.trim().replace(/\/$/,"");if(value)return value;if(process.env.NODE_ENV!=="production")return"http://localhost:3001";throw new Error("Missing APP_URL");}

export async function startPlatformSubscriptionCheckout(schoolId:string){
 const supabase=await createClient(),{data:auth}=await supabase.auth.getClaims(),profileId=auth?.claims?.sub;
 if(!profileId)redirect(`/login?next=${encodeURIComponent(path(schoolId))}`);
 const canManage=await checkSchoolCapability(supabase,schoolId,"school.setup.manage");
 if(!canManage)redirect(`/schools/${schoolId}`);
 await protectServerAction({scope:"platform.subscription.checkout",subject:`actor:${profileId}|school:${schoolId}`,limit:10,windowSeconds:3600});
 const admin=createAdminClient() as unknown as SupabaseClient,mode=getStripeMode(),stripe=getStripe();
 const [{data:school},{data:profile},{data:subscription},{data:plan}]=await Promise.all([
  admin.from("schools").select("name").eq("id",schoolId).single(),
  admin.from("profiles").select("email").eq("id",profileId).single(),
  admin.from("school_platform_subscriptions").select("billing_terms,access_status,stripe_customer_id,stripe_checkout_session_id,checkout_attempt_id").eq("school_id",schoolId).single(),
  admin.from("platform_plans").select("key,trial_days,stripe_test_price_id,stripe_live_price_id").eq("key","main").single(),
 ]);
 if(!school||!profile||!subscription||!plan)redirect(path(schoolId,"unavailable"));
 if(subscription.billing_terms==="complimentary")redirect(path(schoolId,"complimentary"));
 if(["trialing","active"].includes(subscription.access_status))redirect(path(schoolId,"already-active"));
 const priceId=mode==="live"?plan.stripe_live_price_id:plan.stripe_test_price_id;
 if(!priceId)redirect(path(schoolId,"unavailable"));
 if(subscription.stripe_checkout_session_id){
  const prior=await stripe.checkout.sessions.retrieve(subscription.stripe_checkout_session_id);
  if(prior.status==="open"&&prior.url)redirect(prior.url);
  await admin.from("school_platform_subscriptions").update({checkout_attempt_id:crypto.randomUUID(),stripe_checkout_session_id:null}).eq("school_id",schoolId);
 }
 const{data:fresh}=await admin.from("school_platform_subscriptions").select("checkout_attempt_id,stripe_customer_id").eq("school_id",schoolId).single();
 if(!fresh)redirect(path(schoolId,"unavailable"));
 let customerId=fresh.stripe_customer_id;
 if(!customerId){
  const customer=await stripe.customers.create({email:profile.email??undefined,name:school.name,metadata:{school_id:schoolId,application:"common_time"}},{idempotencyKey:`platform-customer-${schoolId}-${mode}`});
  customerId=customer.id;
  await admin.from("school_platform_subscriptions").update({stripe_customer_id:customerId}).eq("school_id",schoolId);
 }
 const base=applicationUrl(),session=await stripe.checkout.sessions.create({mode:"subscription",customer:customerId,payment_method_collection:"always",line_items:[{price:priceId,quantity:1}],subscription_data:{trial_period_days:plan.trial_days,metadata:{school_id:schoolId,plan_key:plan.key,application:"common_time"}},metadata:{school_id:schoolId,plan_key:plan.key,application:"common_time"},success_url:`${base}${path(schoolId,"success")}&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${base}${path(schoolId,"canceled")}`},{idempotencyKey:`platform-checkout-${fresh.checkout_attempt_id}`});
 await admin.from("school_platform_subscriptions").update({stripe_checkout_session_id:session.id}).eq("school_id",schoolId);
 if(!session.url)redirect(path(schoolId,"unavailable"));
 redirect(session.url);
}
