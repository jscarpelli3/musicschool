/* The action-state argument is required by React's Server Action signature. */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use server";
import crypto from "node:crypto";
import {redirect} from "next/navigation";
import {protectServerAction,RequestBoundaryError} from "@/lib/security/request-boundary";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";

export type JoinState={stage:"request"|"verify";ok:boolean;message:string};
const tokenHash=(token:string)=>crypto.createHash("sha256").update(token).digest("hex");
async function invitation(token:string){if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;const {data}=await createAdminClient().from("school_onboarding_invitations").select("id,normalized_email,expires_at,status").eq("token_hash",tokenHash(token)).eq("status","invited").gt("expires_at",new Date().toISOString()).maybeSingle();return data}
export async function requestJoinCode(token:string,_state:JoinState):Promise<JoinState>{const invite=await invitation(token);if(!invite)return{stage:"request",ok:false,message:"This invitation is invalid or has expired. Ask Common Time for a new link."};try{await protectServerAction({scope:"school.join.code",subject:`invitation:${invite.id}`,limit:5,windowSeconds:900,blockSeconds:900});}catch(e){return{stage:"request",ok:false,message:e instanceof RequestBoundaryError&&e.code==="rate_limited"?"Too many codes were requested. Wait 15 minutes and try again.":"The request could not be validated."}}const supabase=await createClient(),{error}=await supabase.auth.signInWithOtp({email:invite.normalized_email,options:{shouldCreateUser:true}});return error?{stage:"request",ok:false,message:"We could not send the code. Wait a moment and try again."}:{stage:"verify",ok:true,message:`We sent a one-time code to ${invite.normalized_email}.`}}
export async function verifyJoinCode(token:string,_state:JoinState,formData:FormData):Promise<JoinState>{const invite=await invitation(token),code=String(formData.get("code")??"").replace(/\s/g,"");if(!invite)return{stage:"request",ok:false,message:"This invitation is invalid or has expired."};if(!/^\d{6,8}$/.test(code))return{stage:"verify",ok:false,message:"Enter the code from your email."};try{await protectServerAction({scope:"school.join.verify",subject:`invitation:${invite.id}`,limit:10,windowSeconds:900,blockSeconds:900});}catch{return{stage:"verify",ok:false,message:"Too many attempts. Wait 15 minutes, then request a new code."}}const supabase=await createClient(),{error}=await supabase.auth.verifyOtp({email:invite.normalized_email,token:code,type:"email"});if(error)return{stage:"verify",ok:false,message:"That code is invalid or expired. Check the newest email and try again."};redirect("/setup")}
