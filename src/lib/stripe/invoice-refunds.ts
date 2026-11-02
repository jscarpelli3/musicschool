import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

export async function reconcileInvoiceRefund(providerRefundId:string,stripeAccount:string,providerEventId:string){
  const refund=await getStripe().refunds.retrieve(providerRefundId,{expand:["charge"]},{stripeAccount});
  const metadata=refund.metadata??{};
  const localId=metadata.payment_refund_id;
  if(!localId||!/^[0-9a-f-]{36}$/i.test(localId))return false;
  const admin=createAdminClient();
  const{data:local,error}=await admin.from("payment_refunds").select("id,amount_cents,currency,payment_attempt_id,provider_refund_id").eq("id",localId).maybeSingle();
  if(error)throw error;if(!local)return false;
  const{data:attempt,error:attemptError}=await admin.from("payment_attempts").select("provider_charge_id,school_id,billing_period_id").eq("id",local.payment_attempt_id).single();
  if(attemptError)throw attemptError;
  const charge=typeof refund.charge==="string"?refund.charge:refund.charge?.id;
  if(refund.id!==providerRefundId||local.provider_refund_id&&local.provider_refund_id!==refund.id||refund.amount!==local.amount_cents||refund.currency.toUpperCase()!==local.currency||charge!==attempt.provider_charge_id||metadata.school_id!==attempt.school_id||metadata.billing_period_id!==attempt.billing_period_id)throw new Error("Invoice refund binding does not match.");
  const rawStatus=String(refund.status);
  const status=rawStatus==="succeeded"?"succeeded":["failed","canceled"].includes(rawStatus)?"failed":"submitted";
  const{error:applyError}=await admin.rpc("apply_invoice_refund_event",{p_payment_refund_id:local.id,p_provider_account_id:stripeAccount,p_provider_refund_id:refund.id,p_status:status,p_failure_message:status==="failed"?"Stripe could not complete this refund.":null,p_provider_event_id:providerEventId});
  if(applyError)throw applyError;return true;
}
