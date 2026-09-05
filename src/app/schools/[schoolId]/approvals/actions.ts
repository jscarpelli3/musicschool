"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { dispatchLessonRequestEmails } from "@/lib/notifications/dispatch-lesson-request-emails";
import { protectServerAction,RequestBoundaryError } from "@/lib/security/request-boundary";

const UUID=/^[0-9a-f-]{36}$/i;
const object=(value:Json):Record<string,Json|undefined>|null=>value&&typeof value==="object"&&!Array.isArray(value)?value:null;

export async function resolveLessonChangeRequest(schoolId:string,requestId:string,input:{decision:"approved"|"declined";lessonResolution:string|null;adjustmentKind:"fee"|"credit"|null;adjustmentAmountCents:number;reason:string}){
 if(!UUID.test(schoolId)||!UUID.test(requestId))return{ok:false,message:"That lesson request could not be verified."};
 if(!["approved","declined"].includes(input.decision)||input.lessonResolution&&!new Set(["count_as_serviced","retain_for_reschedule","waive"]).has(input.lessonResolution)||input.adjustmentKind&&!new Set(["fee","credit"]).has(input.adjustmentKind)||!Number.isInteger(input.adjustmentAmountCents)||input.adjustmentAmountCents<0||input.adjustmentAmountCents>1000000||input.reason.trim().length>1000)return{ok:false,message:"Review the decision details and try again."};
 const supabase=await createClient(),{data:auth}=await supabase.auth.getClaims(),profileId=auth?.claims?.sub;if(!profileId)return{ok:false,message:"Your session expired. Sign in and try again."};
 try{await protectServerAction({scope:"owner.lesson_request.resolve",subject:`actor:${profileId}|school:${schoolId}|request:${requestId}`,limit:12,windowSeconds:600,blockSeconds:300});}catch(caught){return{ok:false,message:caught instanceof RequestBoundaryError&&caught.code==="rate_limited"?"Too many decisions were submitted. Wait a few minutes and try again.":"This decision could not be validated. Reload and try again."};}
 const {data,error}=await supabase.rpc("resolve_owner_lesson_change_request",{p_school_id:schoolId,p_request_id:requestId,p_decision:input.decision,p_lesson_resolution:input.lessonResolution,p_adjustment_kind:input.adjustmentKind,p_adjustment_amount_cents:input.adjustmentAmountCents,p_reason:input.reason.trim()||null});
 if(error){const detail=error.message;const message=detail.includes("override_reason_required")?"Explain why this decision differs from the policy.":detail.includes("lesson_no_longer_scheduled")?"The lesson changed while you were reviewing it. Nothing was applied; reload to see its current state.":detail.includes("scenario_resolution_not_supported")?"This type of lesson change needs the new scenario-specific review flow. Nothing was changed.":detail.includes("request_not_found")||detail.includes("not_authorized")?"That request is unavailable or you no longer have access.":"The request could not be resolved. Nothing changed, so it is safe to try again.";return{ok:false,message};}
 const result=object(data);if(!result)return{ok:false,message:"The request returned an unreadable result. Reload before trying again."};
 if(result.outcome==="stale")return{ok:false,message:`This request is already ${String(result.status??"resolved").replaceAll("_"," ")}. Reload to see the final decision.`};
 await dispatchLessonRequestEmails(requestId);
 revalidatePath(`/schools/${schoolId}`);revalidatePath(`/schools/${schoolId}/approvals`);revalidatePath(`/schools/${schoolId}/notifications`);revalidatePath(`/schools/${schoolId}/students`);revalidatePath(`/schools/${schoolId}/families`);revalidatePath(`/portal`);
 return{ok:true,message:typeof result.message==="string"?result.message:"Lesson request resolved."};
}
