"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type AvailabilityBlock = { weekday: number; start_time: string; end_time: string };

export async function saveTeacherWeeklyAvailability(schoolId: string, teacherId: string, blocks: AvailabilityBlock[]) {
  if (!/^[0-9a-f-]{36}$/i.test(schoolId) || !/^[0-9a-f-]{36}$/i.test(teacherId) || !Array.isArray(blocks) || blocks.length > 28) {
    return { ok: false, message: "The availability schedule is not valid." };
  }
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (blocks.some((block) => !Number.isInteger(block.weekday) || block.weekday < 0 || block.weekday > 6 || !validTime.test(block.start_time) || !validTime.test(block.end_time) || block.start_time >= block.end_time)) {
    return { ok: false, message: "Each block needs a valid day, start time, and later end time." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_teacher_weekly_availability", { p_school_id: schoolId, p_teacher_id: teacherId, p_blocks: blocks });
  if (error) {
    if (error.message.includes("overlap")) return { ok: false, message: "Availability blocks on the same day cannot overlap." };
    if (error.message.includes("not_authorized")) return { ok: false, message: "You no longer have permission to change this availability." };
    return { ok: false, message: "The availability could not be saved. Nothing changed; review the blocks and try again." };
  }
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/teacher`);
  revalidatePath(`/schools/${schoolId}/staff`);
  return { ok: true, message: "Weekly availability saved. Existing lessons were not moved." };
}
