"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeInstrumentNames } from "@/lib/schools/instruments";
import { createClient } from "@/lib/supabase/server";

export async function updateSchoolInstrumentCatalog(schoolId: string, formData: FormData) {
  const chosen = formData.getAll("instrument").map(String);
  const other = String(formData.get("other_instruments") ?? "").split(/\r?\n|,/);
  const names = normalizeInstrumentNames([...chosen, ...other]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_school_instrument_catalog", { p_school_id: schoolId, p_names: names });
  if (error) redirect(`/schools/${schoolId}/staff?instruments=error`);
  revalidatePath(`/schools/${schoolId}/staff`);
  redirect(`/schools/${schoolId}/staff?instruments=saved`);
}
