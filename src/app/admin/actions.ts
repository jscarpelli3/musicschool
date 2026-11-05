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
export async function issueSchoolInvitation(_state:InviteSchoolState,formData:FormData):Promise<InviteSchoolState>{
 const email=String(formData.get("email")??"").trim().toLowerCase(),schoolName=String(formData.get("school_name")??"").trim();
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>320)return{ok:false,message:"Enter the beta tester’s valid email address."};
 if(schoolName.length>120)return{ok:false,message:"Keep the school name under 120 characters."};
 const {profileId}=await requirePlatformAdmin();
 try{await protectServerAction({scope:"platform.school_invitation.issue",subject:`actor:${profileId}|email:${email}`,limit:10,windowSeconds:3600});}
 catch(error){return{ok:false,message:error instanceof RequestBoundaryError&&error.code==="rate_limited"?"Invitation limit reached. Wait before issuing another.":"The request could not be validated."};}
 const admin=createAdminClient(),rawToken=crypto.randomBytes(32).toString("base64url"),tokenHash=crypto.createHash("sha256").update(rawToken).digest("hex");
 const inserted=await admin.rpc("issue_school_onboarding_invitation",{p_email:email,p_token_hash:tokenHash,p_expires_at:new Date(Date.now()+14*86400000).toISOString(),p_school_name:schoolName,p_issued_by:profileId});
 if(inserted.error||!inserted.data)return{ok:false,message:"The invitation could not be issued."};
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
