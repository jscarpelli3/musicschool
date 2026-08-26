"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
const UUID=/^[0-9a-f-]{36}$/i;
export async function manageNotifications(schoolId:string,ids:string[],action:"read"|"unread"|"archive"|"restore"){
 if(!UUID.test(schoolId)||!ids.length||ids.length>100||ids.some(id=>!UUID.test(id)))return{ok:false,message:"Choose between 1 and 100 notifications."};
 const {error}=await(await createClient()).rpc("manage_my_notifications",{p_school_id:schoolId,p_notification_ids:ids,p_action:action});
 if(error)return{ok:false,message:"Those notifications could not be updated."};
 revalidatePath(`/schools/${schoolId}/notifications`);return{ok:true,message:action==="archive"?"Notifications archived.":action==="restore"?"Notifications restored.":"Notifications updated."};
}
export async function decideTeacherRescheduleProposal(schoolId:string,proposalId:string,decision:"accept"|"decline"){
 if(!UUID.test(schoolId)||!UUID.test(proposalId)||!new Set(["accept","decline"]).has(decision))return{ok:false,message:"That proposal could not be verified."};
 const {data,error}=await(await createClient()).rpc("decide_teacher_reschedule_proposal",{p_school_id:schoolId,p_proposal_id:proposalId,p_decision:decision});
 if(error){const message=error.message.includes("proposal_stale")?"The original lesson changed after this proposal was sent. Nothing moved; ask the teacher to submit a fresh proposal.":error.message.includes("lesson_conflict")?"That proposed time now conflicts with another lesson. Nothing moved.":"The proposal could not be updated. Nothing moved.";return{ok:false,message};}
 revalidatePath(`/schools/${schoolId}/notifications`);revalidatePath(`/schools/${schoolId}`);revalidatePath(`/schools/${schoolId}/teacher`);
 return{ok:true,message:data==="applied"?"Proposal approved. The lesson has moved and the teacher was notified.":"Proposal declined. The original lesson remains scheduled."};
}
