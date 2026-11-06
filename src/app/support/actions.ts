"use server";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import type {SupabaseClient} from "@supabase/supabase-js";
import {protectServerAction} from "@/lib/security/request-boundary";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient} from "@/lib/supabase/server";

export type SupportState={ok:boolean;message:string;ticketId?:string};
const kinds=new Set(["problem","question","idea","billing"]),mimeExtensions:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
export async function submitSupportTicket(_state:SupportState,formData:FormData):Promise<SupportState>{
 const supabase=await createClient(),{data:auth}=await supabase.auth.getClaims(),profileId=auth?.claims?.sub;if(!profileId)redirect("/login?next=/support");
 const category=String(formData.get("category")??""),subject=String(formData.get("subject")??"").trim(),notes=String(formData.get("notes")??"").trim(),schoolId=String(formData.get("school_id")??"").trim()||null,pageUrl=String(formData.get("page_url")??"").trim()||null;
 if(!kinds.has(category)||subject.length<3||subject.length>120||notes.length<10||notes.length>5000)return{ok:false,message:"Add a short subject and enough detail for us to understand the request."};
 const files=formData.getAll("screenshots").filter((entry):entry is File=>entry instanceof File&&entry.size>0);if(files.length>3)return{ok:false,message:"Attach no more than three screenshots."};
 for(const file of files)if(file.size>5242880||!mimeExtensions[file.type])return{ok:false,message:"Screenshots must be JPG, PNG, or WebP files no larger than 5 MB each."};
 await protectServerAction({scope:"platform.support.submit",subject:`actor:${profileId}`,limit:10,windowSeconds:3600,blockSeconds:900});
 const admin=createAdminClient() as unknown as SupabaseClient;
 if(schoolId){const{data:member}=await admin.from("school_members").select("school_id").eq("school_id",schoolId).eq("profile_id",profileId).eq("status","active").maybeSingle();if(!member)return{ok:false,message:"That school is not available for this support request."};}
 const{data:ticket,error}=await admin.from("platform_support_tickets").insert({submitted_by:profileId,school_id:schoolId,category,subject,notes,page_url:pageUrl}).select("id").single();if(error||!ticket)return{ok:false,message:"The support ticket could not be created. Nothing was uploaded; try again."};
 let uploadFailed=false;
 for(const file of files){const path=`${profileId}/${ticket.id}/${crypto.randomUUID()}.${mimeExtensions[file.type]}`,{error:uploadError}=await admin.storage.from("support-attachments").upload(path,await file.arrayBuffer(),{contentType:file.type,upsert:false,cacheControl:"3600"});if(uploadError){uploadFailed=true;continue;}const{error:recordError}=await admin.from("platform_support_attachments").insert({ticket_id:ticket.id,uploaded_by:profileId,storage_path:path,original_filename:file.name.slice(0,255)||"screenshot",mime_type:file.type,size_bytes:file.size});if(recordError)uploadFailed=true;}
 revalidatePath("/support");return{ok:true,ticketId:ticket.id,message:uploadFailed?"Your ticket was created, but at least one screenshot could not be attached.":"Your support ticket was submitted."};
}
