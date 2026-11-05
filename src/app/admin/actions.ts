"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { schoolOnboardingInvitationEmail } from "@/lib/resend/school-onboarding-invitation-email";
import { ResendRequestError, ResendUnknownOutcomeError, sendResendEmail } from "@/lib/resend/server";
import { schoolEmailSender } from "@/lib/resend/email-security";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteSchoolState={ok:boolean;message:string;inviteUrl?:string;recipient?:string;delivery?:"accepted"|"failed"|"reconciliation_required"};
export type PlatformBillingState={ok:boolean;message:string};

export async function setSchoolPlatformBillingTerms(schoolId:string,_state:PlatformBillingState,formData:FormData):Promise<PlatformBillingState>{
 if(!/^[0-9a-f-]{36}$/i.test(schoolId))return{ok:false,message:"That school could not be identified."};
 const terms=String(formData.get("terms")??""),reason=String(formData.get("reason")??"").trim(),endsOn=String(formData.get("ends_on")??"").trim();
 if(!new Set(["standard","complimentary"]).has(terms))return{ok:false,message:"Choose available billing terms."};
 if(terms==="complimentary"&&(!reason||reason.length>500))return{ok:false,message:"Record a short internal reason for complimentary access."};
 const endsAt=endsOn?new Date(`${endsOn}T23:59:59.999Z`):null;
 if(endsAt&&(!Number.isFinite(endsAt.getTime())||endsAt.getTime()<=Date.now()))return{ok:false,message:"Choose a future ending date or leave it blank."};
 const{profileId}=await requirePlatformAdmin(),admin=createAdminClient();
 const rpc=admin.rpc.bind(admin) as unknown as(name:string,args:Record<string,unknown>)=>Promise<{error:{code?:string;message:string}|null}>;
 const{error}=await rpc("set_school_platform_billing_terms",{p_school_id:schoolId,p_terms:terms,p_actor_profile_id:profileId,p_reason:terms==="complimentary"?reason:null,p_ends_at:terms==="complimentary"?endsAt?.toISOString()??null:null,p_custom_monthly_price_cents:null});
 if(error){console.error("Platform billing terms update failed",{schoolId,code:error.code??"unknown"});return{ok:false,message:"The school’s Common Time billing terms were not changed."};}
 revalidatePath("/admin");
 return{ok:true,message:terms==="complimentary"?"Main plan fee waived. The school has complimentary access.":"Complimentary access ended. No card was charged; payment setup is now required."};
}
export async function issueSchoolInvitation(_state:InviteSchoolState,formData:FormData):Promise<InviteSchoolState>{
 const email=String(formData.get("email")??"").trim().toLowerCase(),schoolName=String(formData.get("school_name")??"").trim();
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>320)return{ok:false,message:"Enter the beta tester’s valid email address."};
 if(schoolName.length>120)return{ok:false,message:"Keep the school name under 120 characters."};
 const {profileId}=await requirePlatformAdmin();
 try{await protectServerAction({scope:"platform.school_invitation.issue",subject:`actor:${profileId}|email:${email}`,limit:10,windowSeconds:3600});}
 catch(error){return{ok:false,message:error instanceof RequestBoundaryError&&error.code==="rate_limited"?"Invitation limit reached. Wait before issuing another.":"The request could not be validated."};}
 const admin=createAdminClient(),rawToken=crypto.randomBytes(32).toString("base64url"),tokenHash=crypto.createHash("sha256").update(rawToken).digest("hex");
 const invitationRpc=admin.rpc.bind(admin) as unknown as(name:string,args:Record<string,unknown>)=>Promise<{data:unknown;error:{code?:string;message:string}|null}>;
 const inserted=await invitationRpc("issue_school_onboarding_invitation",{p_email:email,p_token_hash:tokenHash,p_expires_at:new Date(Date.now()+14*86400000).toISOString(),p_school_name:schoolName||null,p_issued_by:profileId});
 if(inserted.error||!inserted.data){
  console.error("School onboarding invitation issuance failed",{code:inserted.error?.code??"no_result",message:inserted.error?.message??"Invitation RPC returned no identifier."});
  return{ok:false,message:"The secure invitation link could not be created. No email was sent."};
 }
 const invitationId=String(inserted.data),origin=(process.env.APP_URL??"https://app.commontime.studio").replace(/\/$/,""),inviteUrl=`${origin}/join/${rawToken}`;
 const message=schoolOnboardingInvitationEmail({schoolName:schoolName||undefined,inviteUrl});
 try{
  const sent=await sendResendEmail({from:schoolEmailSender("Common Time"),to:email,subject:message.subject,text:message.text,html:message.html,idempotencyKey:`school-onboarding-invitation-${invitationId}`,messageKind:"school_onboarding_invitation",timeoutMs:10_000});
  const recorded=await admin.rpc("record_school_onboarding_invitation_delivery",{p_invitation_id:invitationId,p_status:"accepted",p_provider_email_id:sent.id,p_provider_error_code:null});
  if(recorded.error)throw new ResendUnknownOutcomeError("The email was accepted but its delivery record could not be finalized.");
  revalidatePath("/admin");
  return{ok:true,message:`Invitation sent to ${email}. It expires in 14 days.`,inviteUrl,recipient:email,delivery:"accepted"};
 }catch(error){
  const unknown=error instanceof ResendUnknownOutcomeError;
  const provider=error instanceof ResendRequestError?error:null;
  await admin.rpc("record_school_onboarding_invitation_delivery",{p_invitation_id:invitationId,p_status:unknown?"reconciliation_required":"failed",p_provider_email_id:null,p_provider_error_code:provider?.code??(unknown?"provider_outcome_unknown":"request_failed")});
  revalidatePath("/admin");
  return{ok:false,message:unknown?`The provider outcome for ${email} is unknown. Do not resend yet; use the copy-link fallback if needed.`:`The email to ${email} was not sent. You can copy the private link below or try again.`,inviteUrl,recipient:email,delivery:unknown?"reconciliation_required":"failed"};
 }
}
