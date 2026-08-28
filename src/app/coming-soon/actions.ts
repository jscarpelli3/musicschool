"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assertTrustedMarketingServerActionRequest, enforceRateLimit, requestIp, RequestBoundaryError } from "@/lib/security/request-boundary";

export type EarlyAccessState={ok:boolean;message:string};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function joinEarlyAccess(_state:EarlyAccessState,formData:FormData):Promise<EarlyAccessState>{
 if(String(formData.get("website")??""))return{ok:true,message:"You’re on the list. We’ll let you know when Common Time is ready."};
 const email=String(formData.get("email")??"").trim().toLowerCase(),name=String(formData.get("name")??"").trim(),schoolName=String(formData.get("schoolName")??"").trim();
 if(!EMAIL.test(email)||email.length>320||name.length>160||schoolName.length>160)return{ok:false,message:"Enter a valid email address. Name and school are optional."};
 try{
  const headers=await assertTrustedMarketingServerActionRequest();
  await enforceRateLimit({scope:"public.early-access",subject:`email:${email}|ip:${requestIp(headers)}`,limit:5,windowSeconds:3600,blockSeconds:3600});
 }catch(caught){return{ok:false,message:caught instanceof RequestBoundaryError&&caught.code==="rate_limited"?"That address was submitted several times. You’re likely already on the list; try again in an hour if needed.":"This signup could not be validated. Reload the page and try again."};}
 const admin=createAdminClient(),rpc=admin.rpc.bind(admin) as unknown as(name:string,args:Record<string,unknown>)=>Promise<{error:{code?:string;message:string}|null}>;
 const {error}=await rpc("record_early_access_signup",{p_email:email,p_name:name||null,p_school_name:schoolName||null});
 if(error){const reference=crypto.randomUUID().slice(0,8).toUpperCase();console.error("Early access signup failed",{reference,code:error.code,message:error.message});return{ok:false,message:`We couldn’t save your signup. Nothing else was submitted; try again. Reference ${reference}.`};}
 return{ok:true,message:"You’re on the list. We’ll let you know when Common Time is ready."};
}
