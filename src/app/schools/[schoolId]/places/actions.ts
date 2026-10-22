"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PlaceState = { error: string | null };

export async function createPlace(
  schoolId: string,
  returnPath: string | undefined,
  _state: PlaceState,
  formData: FormData,
): Promise<PlaceState> {
  const name = String(formData.get("name") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim() || null;
  const kind = String(formData.get("kind") ?? "school");
  if (!name || name.length > 120) return { error: "Enter a place name up to 120 characters." };
  if (details && details.length > 500) return { error: "Place details must be 500 characters or fewer." };
  if (!["school", "student_home", "online", "other"].includes(kind)) return { error: "Choose a valid place type." };
  if (kind === "student_home" && details) return { error: "Manage a family's private home address from its family record." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/places`);

  const { error } = await supabase.from("lesson_places").insert({
    school_id: schoolId,
    name,
    details,
    kind,
    created_by: profileId,
  });

  if (error) {
    return { error: error.code === "23505" ? "That place is already on the list." : error.message };
  }

  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/places`);
  revalidatePath(`/schools/${schoolId}/onboarding`);
  const onboardingPath = `/schools/${schoolId}/onboarding?step=locations`;
  redirect(returnPath === onboardingPath ? `${onboardingPath}&placeCreated=1` : `/schools/${schoolId}/places?created=1`);
}

export async function archivePlace(schoolId: string, placeId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=/schools/${schoolId}/places`);

  const { data: archived, error } = await supabase
    .from("lesson_places")
    .update({ status: "archived" })
    .eq("school_id", schoolId)
    .eq("id", placeId)
    .select("id")
    .maybeSingle();

  if (error || !archived) redirect(`/schools/${schoolId}/places?error=archive`);

  revalidatePath(`/schools/${schoolId}/places`);
  redirect(`/schools/${schoolId}/places?archived=1`);
}
