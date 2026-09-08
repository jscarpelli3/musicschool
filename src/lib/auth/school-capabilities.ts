import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const schoolCapabilities = [
  "school.workspace.view",
  "teacher.workspace.use",
  "school.lessons.manage",
  "school.approvals.review",
  "school.billing.manage",
  "school.policies.manage",
  "school.products.manage",
  "school.places.create",
  "school.places.manage",
  "school.setup.manage",
  "school.appearance.manage",
  "school.appearance.palette_manage",
  "school.staff.directory_manage",
  "school.teacher_records.manage",
  "school.student_support.view",
] as const;

export type SchoolCapability = typeof schoolCapabilities[number];

export async function checkSchoolCapability(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  capability: SchoolCapability,
) {
  const { data, error } = await supabase.rpc("has_school_capability", {
    p_school_id: schoolId,
    p_capability: capability,
  });
  if (error) throw new Error("School capability could not be checked.");
  return data === true;
}

export async function loadMySchoolCapabilities(schoolId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_school_capabilities", { p_school_id: schoolId });
  if (error) throw new Error("School capabilities could not be loaded.");
  const known = new Set<string>(schoolCapabilities);
  return new Set((data ?? []).filter((capability): capability is SchoolCapability => known.has(capability)));
}
