"use server";

import { revalidatePath } from "next/cache";
import { normalizeInstrumentNames } from "@/lib/schools/instruments";
import { createClient } from "@/lib/supabase/server";

export type InstrumentCatalogResult = { ok: boolean; message: string };

export async function updateSchoolInstrumentCatalog(schoolId: string, formData: FormData): Promise<InstrumentCatalogResult> {
  const names = normalizeInstrumentNames([
    ...formData.getAll("instrument").map(String),
    ...String(formData.get("other_instruments") ?? "").split(/\r?\n|,/),
  ]);
  const { error } = await (await createClient()).rpc("set_school_instrument_catalog", { p_school_id: schoolId, p_names: names });
  if (error) return { ok: false, message: "The instrument list could not be saved." };
  revalidatePath(`/schools/${schoolId}/setup`);
  revalidatePath(`/schools/${schoolId}/staff`);
  revalidatePath(`/schools/${schoolId}/onboarding`);
  return { ok: true, message: "School instruments saved." };
}
