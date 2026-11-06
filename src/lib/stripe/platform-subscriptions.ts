import "server-only";
import type Stripe from "stripe";
import type {SupabaseClient} from "@supabase/supabase-js";
import {getStripe,getStripeMode} from "./server";
import {createAdminClient} from "@/lib/supabase/admin";

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function access(status:Stripe.Subscription.Status){if(status==="trialing")return"trialing";if(status==="active")return"active";if(["past_due","unpaid","paused","incomplete"].includes(status))return"past_due";return"canceled";}
async function persist(subscription:Stripe.Subscription,schoolId:string,checkoutId?:string){
 if(!uuid.test(schoolId)||subscription.metadata.application!=="common_time"||subscription.metadata.school_id!==schoolId)return false;
 const admin=createAdminClient() as unknown as SupabaseClient,mode=getStripeMode();
 const[{data:local},{data:plan}]=await Promise.all([admin.from("school_platform_subscriptions").select("billing_terms").eq("school_id",schoolId).single(),admin.from("platform_plans").select("stripe_test_price_id,stripe_live_price_id").eq("key","main").single()]);
 if(!local||!plan||local.billing_terms==="complimentary")return false;
 const expected=mode==="live"?plan.stripe_live_price_id:plan.stripe_test_price_id,item=subscription.items.data[0];
 if(!expected||!item||item.price.id!==expected)throw new Error("Platform subscription price binding failed.");
 const{error}=await admin.from("school_platform_subscriptions").update({access_status:access(subscription.status),stripe_customer_id:typeof subscription.customer==="string"?subscription.customer:subscription.customer.id,stripe_subscription_id:subscription.id,stripe_checkout_session_id:checkoutId,stripe_status:subscription.status,trial_ends_at:subscription.trial_end?new Date(subscription.trial_end*1000).toISOString():null,current_period_ends_at:item.current_period_end?new Date(item.current_period_end*1000).toISOString():null,cancel_at_period_end:subscription.cancel_at_period_end}).eq("school_id",schoolId);
 if(error)throw error;return true;
}
export async function reconcilePlatformCheckout(sessionId:string){const stripe=getStripe(),session=await stripe.checkout.sessions.retrieve(sessionId,{expand:["subscription"]});if(session.mode!=="subscription"||session.metadata?.application!=="common_time")return false;const subscription=session.subscription;if(!subscription||typeof subscription==="string")throw new Error("Platform Checkout subscription was not expanded.");return persist(subscription,session.metadata.school_id??"",session.id);}
export async function reconcilePlatformSubscription(subscriptionId:string){const subscription=await getStripe().subscriptions.retrieve(subscriptionId);if(subscription.metadata.application!=="common_time")return false;return persist(subscription,subscription.metadata.school_id??"");}
