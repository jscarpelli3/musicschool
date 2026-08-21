"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setTeacherSelfReschedulePermission(schoolId: string, teacherId: string, formData: FormData) {
  const allowed = formData.get("allowed") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_teacher_self_reschedule_permission", {
    p_school_id: schoolId,
    p_teacher_id: teacherId,
    p_allowed: allowed,
  });
  if (error) throw new Error("The teacher permission could not be changed.");
  revalidatePath(`/schools/${schoolId}/staff`);
}
