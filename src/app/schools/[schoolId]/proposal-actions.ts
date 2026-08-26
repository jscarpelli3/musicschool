"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dispatchLessonProposalEmail } from "@/lib/notifications/dispatch-lesson-proposal-email";

const UUID=/^[0-9a-f-]{36}$/i;
export async function manageOwnProposal(schoolId:string,proposalId:string,action:"withdraw"|"replace",localStart?:string,reason?:string){
 if(!UUID.test(schoolId)||!UUID.test(proposalId)||!new Set(["withdraw","replace"]).has(action))return{ok:false,message:"That proposal could not be verified."};
 if(action==="replace"&&(!localStart||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(localStart)||!reason?.trim()))return{ok:false,message:"Choose a replacement date and time and include a short note."};
 const supabase=await createClient();
 const rpc=supabase.rpc as unknown as (name:string,args:Record<string,unknown>)=>Promise<{data:Record<string,unknown>|null;error:{message:string}|null}>;
 const {data,error}=await rpc("manage_own_lesson_schedule_proposal",{p_school_id:schoolId,p_proposal_id:proposalId,p_action:action,p_local_start:localStart?`${localStart.replace("T"," ")}:00`:null,p_reason:reason?.trim()||null});
 if(error)return{ok:false,message:error.message.includes("not_authorized")?"Only the person who proposed this time can change it.":"The proposal could not be changed. Nothing was lost; reload and try again."};
 if(data?.outcome==="stale")return{ok:false,message:data.status==="superseded"?"This proposal was already replaced. The current proposal has been loaded.":`This proposal is already ${String(data?.status??"resolved").replaceAll("_"," ")}.`};
 if(typeof data?.proposal_id==="string")await dispatchLessonProposalEmail(data.proposal_id);
 revalidatePath(`/schools/${schoolId}`);revalidatePath(`/schools/${schoolId}/teacher`);revalidatePath(`/schools/${schoolId}/staff`);revalidatePath(`/schools/${schoolId}/approvals`);
 return{ok:true,message:action==="withdraw"?"Proposal withdrawn. It was removed from active calendars and notifications.":"Proposal replaced. The recipient received the updated request."};
}
