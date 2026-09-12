"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";
import { createAdminClient } from "@/lib/supabase/admin";

export type InviteSchoolState={ok:boolean;message:string;inviteUrl?:string};
export async function issueSchoolInvitation(_state:InviteSchoolState,formData:FormData):Promise<InviteSchoolState>{
 const email=String(formData.get("email")??"").trim().toLowerCase(),schoolName=String(formData.get("school_name")??"").trim();
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>320)return{ok:false,message:"Enter the beta tester’s valid email address."};
 if(schoolName.length>120)return{ok:false,message:"Keep the school name under 120 characters."};
 const {profileId}=await requirePlatformAdmin();
 try{await protectServerAction({scope:"platform.school_invitation.issue",subject:`actor:${profileId}|email:${email}`,limit:10,windowSeconds:3600});}
 catch(error){return{ok:false,message:error instanceof RequestBoundaryError&&error.code==="rate_limited"?"Invitation limit reached. Wait before issuing another.":"The request could not be validated."};}
 const admin=createAdminClient(),rawToken=crypto.randomBytes(32).toString("base64url"),tokenHash=crypto.createHash("sha256").update(rawToken).digest("hex");
 const inserted=await admin.rpc("issue_school_onboarding_invitation",{p_email:email,p_token_hash:tokenHash,p_expires_at:new Date(Date.now()+14*86400000).toISOString(),p_school_name:schoolName,p_issued_by:profileId});
 if(inserted.error)return{ok:false,message:"The invitation could not be issued."};
 revalidatePath("/admin");
 const origin=(process.env.APP_URL??"https://app.commontime.studio").replace(/\/$/,"");
 return{ok:true,message:`Invitation ready for ${email}. It expires in 14 days.`,inviteUrl:`${origin}/join/${rawToken}`};
}
