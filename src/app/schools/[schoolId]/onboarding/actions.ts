"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function finishOnboarding(schoolId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_school_onboarding", { p_school_id: schoolId });
  if (error) redirect(`/schools/${schoolId}/onboarding?finish=error`);
  revalidatePath("/", "layout");
  redirect(`/schools/${schoolId}?welcome=1`);
}
