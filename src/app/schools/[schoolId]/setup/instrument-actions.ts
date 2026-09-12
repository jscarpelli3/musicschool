"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeInstrumentNames } from "@/lib/schools/instruments";
import { createClient } from "@/lib/supabase/server";

export async function updateSchoolInstrumentCatalog(schoolId: string, formData: FormData) {
  const requestedReturnPath = String(formData.get("return_path") ?? "");
  const returnPath = requestedReturnPath === `/schools/${schoolId}/onboarding` ? requestedReturnPath : `/schools/${schoolId}/setup`;
  const names = normalizeInstrumentNames([
    ...formData.getAll("instrument").map(String),
    ...String(formData.get("other_instruments") ?? "").split(/\r?\n|,/),
  ]);
  const { error } = await (await createClient()).rpc("set_school_instrument_catalog", { p_school_id: schoolId, p_names: names });
  if (error) redirect(`${returnPath}?instruments=error`);
  revalidatePath(`/schools/${schoolId}/setup`);
  revalidatePath(`/schools/${schoolId}/staff`);
  revalidatePath(`/schools/${schoolId}/onboarding`);
  redirect(`${returnPath}?instruments=saved`);
}
