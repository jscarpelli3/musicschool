"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateSchoolState = { error: string | null };

export async function createSchool(
  _state: CreateSchoolState,
  formData: FormData,
): Promise<CreateSchoolState> {
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/Chicago");

  if (!name) return { error: "Enter a school name." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { data: schoolId, error } = await supabase.rpc("create_school", {
    school_name: name,
    school_timezone: timezone,
  });

  if (error || !schoolId) {
    return { error: error?.message ?? "The school could not be created." };
  }

  redirect(`/schools/${schoolId}`);
}
