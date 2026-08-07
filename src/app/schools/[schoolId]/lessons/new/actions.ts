"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const knownErrors = [
  "outside_teacher_availability", "teacher_conflict", "student_conflict",
  "override_reason_required", "invalid_school_or_offering", "invalid_teacher",
  "invalid_student", "invalid_place", "lesson_too_far_in_past",
] as const;

export async function createSingleLesson(schoolId: string, formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const teacherId = String(formData.get("teacher_id") ?? "");
  const studentId = String(formData.get("student_id") ?? "");
  const placeId = String(formData.get("place_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const allowOutside = formData.get("allow_outside_availability") === "on";
  const overrideReason = String(formData.get("override_reason") ?? "").trim() || undefined;
  const returnPath = `/schools/${schoolId}/lessons/new`;

  if (![productId, teacherId, studentId, placeId].every((value) => /^[0-9a-f-]{36}$/i.test(value))
      || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)
      || (notes?.length ?? 0) > 1000 || (overrideReason?.length ?? 0) > 240) {
    redirect(`${returnPath}?status=invalid`);
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=${returnPath}`);

  const { data: eventId, error } = await supabase.rpc("create_single_lesson", {
    p_school_id: schoolId,
    p_product_id: productId,
    p_teacher_id: teacherId,
    p_student_id: studentId,
    p_place_id: placeId,
    p_local_start: `${date} ${time}:00`,
    p_notes: notes,
    p_allow_outside_availability: allowOutside,
    p_override_reason: overrideReason,
  });

  if (error || !eventId) {
    const status = knownErrors.find((code) => error?.message.includes(code)) ?? "error";
    redirect(`${returnPath}?status=${status}`);
  }

  revalidatePath(`/schools/${schoolId}`);
  redirect(`${returnPath}?status=created`);
}
