import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
export type OwnerApprovalItem = { id:string;status:string;teacherId:string;studentId:string;teacher:string;student:string;original:string|null;proposed:string;reason:string;createdAt:string };

export async function loadOwnerApprovals(client:Client,schoolId:string,{teacherId,studentIds,history=false}:{teacherId?:string;studentIds?:string[];history?:boolean}={}){
 let query=client.from("lesson_schedule_proposals").select("id,status,teacher_id,student_id,original_starts_at,proposed_starts_at,reason,created_at").eq("school_id",schoolId).eq("proposal_kind","reschedule").order("created_at",{ascending:false});
 query=history?query.neq("status","pending_owner"):query.eq("status","pending_owner");
 if(teacherId)query=query.eq("teacher_id",teacherId);if(studentIds)query=studentIds.length?query.in("student_id",studentIds):query.in("student_id",["00000000-0000-0000-0000-000000000000"]);
 const {data,error}=await query;if(error)throw new Error(`Approvals could not load: ${error.message}`);
 const ids=[...new Set((data??[]).flatMap(row=>[row.teacher_id,row.student_id]))];
 const {data:people,error:peopleError}=ids.length?await client.from("people").select("id,first_name,last_name,preferred_name").eq("school_id",schoolId).in("id",ids):{data:[],error:null};if(peopleError)throw new Error(`Approval people could not load: ${peopleError.message}`);
 const names=new Map((people??[]).map(person=>[person.id,`${person.preferred_name||person.first_name} ${person.last_name}`]));
 return (data??[]).map(row=>({...row,teacherId:row.teacher_id,studentId:row.student_id,teacher:names.get(row.teacher_id)??"Teacher",student:names.get(row.student_id)??"Student",original:row.original_starts_at,proposed:row.proposed_starts_at,createdAt:row.created_at})) satisfies OwnerApprovalItem[];
}
