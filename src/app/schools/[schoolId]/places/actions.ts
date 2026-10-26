"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PlaceState = { error: string | null };

export async function createPlace(
  schoolId: string,
  _state: PlaceState,
  formData: FormData,
): Promise<PlaceState> {
  const kind = "school";
  const submittedName = String(formData.get("name") ?? "").trim();
  const name = submittedName;
  const details = String(formData.get("details") ?? "").trim() || null;
  if (!name || name.length > 120) return { error: "Enter a place name up to 120 characters." };
  if (details && details.length > 500) return { error: "Place details must be 500 characters or fewer." };

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
  revalidatePath(`/schools/${schoolId}/products`);
  revalidatePath(`/schools/${schoolId}/onboarding`);
  redirect(`/schools/${schoolId}/products?roomCreated=1#lesson-places`);
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
    .eq("kind", "school")
    .select("id")
    .maybeSingle();

  if (error || !archived) redirect(`/schools/${schoolId}/products?roomError=archive#lesson-places`);

  revalidatePath(`/schools/${schoolId}/products`);
  redirect(`/schools/${schoolId}/products?roomArchived=1#lesson-places`);
}
