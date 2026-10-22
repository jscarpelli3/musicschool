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
  const kind = String(formData.get("kind") ?? "school");
  const submittedName = String(formData.get("name") ?? "").trim();
  const name = kind === "student_home" ? "Student home" : kind === "online" ? "Online" : submittedName;
  const details = kind === "school" ? String(formData.get("details") ?? "").trim() || null : null;
  if (!name || name.length > 120) return { error: "Enter a place name up to 120 characters." };
  if (details && details.length > 500) return { error: "Place details must be 500 characters or fewer." };
  if (!["school", "student_home", "online"].includes(kind)) return { error: "Choose a valid place type." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) redirect(`/login?next=/schools/${schoolId}/places`);

  if (kind !== "school") {
    const { data: existing } = await supabase.from("lesson_places").select("id").eq("school_id", schoolId).eq("kind", kind).eq("status", "active").limit(1).maybeSingle();
    if (existing) return { error: `${name} is already available.` };
  }
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
  revalidatePath(`/schools/${schoolId}/products`);
  revalidatePath(`/schools/${schoolId}/onboarding`);
  const onboardingPath = `/schools/${schoolId}/onboarding?step=payments`;
  redirect(returnPath === onboardingPath ? `${onboardingPath}&placeCreated=1` : `/schools/${schoolId}/products?placeCreated=1#lesson-spaces`);
}

export async function archivePlace(schoolId: string, placeId: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=/schools/${schoolId}/products`);

  const { data: archived, error } = await supabase
    .from("lesson_places")
    .update({ status: "archived" })
    .eq("school_id", schoolId)
    .eq("id", placeId)
    .select("id")
    .maybeSingle();

  if (error || !archived) redirect(`/schools/${schoolId}/products?placeError=archive#lesson-spaces`);

  revalidatePath(`/schools/${schoolId}/products`);
  redirect(`/schools/${schoolId}/products?placeArchived=1#lesson-spaces`);
}
