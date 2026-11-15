"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkSchoolCapability } from "@/lib/auth/school-capabilities";
import { createClient } from "@/lib/supabase/server";

export type StudentRecordState = { ok: boolean; message: string };
export type ContactRelationshipState = { ok: boolean; message: string };

export async function updateStudentRecord(schoolId: string, studentId: string, _previous: StudentRecordState, formData: FormData): Promise<StudentRecordState> {
  void _previous;
  const path = `/schools/${schoolId}/students/${studentId}`;
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const preferredName = String(formData.get("preferredName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim();
  const enrollmentStatus = String(formData.get("enrollmentStatus") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!firstName && !lastName) return { ok: false, message: "Enter a first name, a last name, or both." };
  if (firstName.length > 80 || lastName.length > 80 || preferredName.length > 80) return { ok: false, message: "Names must be 80 characters or fewer." };
  if (email && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320)) return { ok: false, message: "Enter a valid email or leave it blank." };
  if (!new Set(["prospect", "active", "paused", "former"]).has(enrollmentStatus)) return { ok: false, message: "Choose a valid enrollment status." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=${path}`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.billing.manage")) return { ok: false, message: "You do not have permission to edit this student." };
  const { error } = await supabase.rpc("update_student_record", {
    p_birth_date: birthDate || null, p_email: email || null, p_enrollment_status: enrollmentStatus,
    p_first_name: firstName, p_last_name: lastName, p_notes: notes || null, p_phone: phone || null,
    p_preferred_name: preferredName || null, p_school_id: schoolId, p_student_id: studentId,
  });
  if (error) return { ok: false, message: "The student record could not be saved. Nothing changed." };
  revalidatePath(path);
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/students`);
  return { ok: true, message: "Student record saved." };
}

export async function updateContactRelationship(schoolId: string, studentId: string, contactPersonId: string, _previous: ContactRelationshipState, formData: FormData): Promise<ContactRelationshipState> {
  void _previous;
  const path = `/schools/${schoolId}/students/${studentId}`;
  const relationship = String(formData.get("relationship") ?? "").trim();
  if (!relationship || relationship.length > 40) return { ok: false, message: "Enter a relationship of 40 characters or fewer." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect(`/login?next=${path}`);
  if (!await checkSchoolCapability(supabase, schoolId, "school.billing.manage")) return { ok: false, message: "You do not have permission to edit this contact." };
  const { error } = await supabase.rpc("update_student_contact_relationship", { p_contact_person_id: contactPersonId, p_relationship: relationship, p_school_id: schoolId, p_student_id: studentId });
  if (error) return { ok: false, message: "The relationship could not be saved. Nothing changed." };
  revalidatePath(path);
  return { ok: true, message: "Relationship saved." };
}
