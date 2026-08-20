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
