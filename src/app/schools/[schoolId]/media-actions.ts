"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 2 * 1024 * 1024;

function validImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.size <= maxBytes && allowedTypes.has(value.type);
}

export async function uploadSchoolLogo(schoolId: string, formData: FormData) {
  const requestedReturnPath = String(formData.get("return_path") ?? "");
  const returnPath = requestedReturnPath === `/schools/${schoolId}/setup`
    ? requestedReturnPath
    : `/schools/${schoolId}`;
  const image = formData.get("logo");
  if (!validImage(image)) redirect(`${returnPath}?media=invalid-logo`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=/schools/${schoolId}`);

  const path = `${schoolId}/logo`;
  const { error: uploadError } = await supabase.storage
    .from("school-logos")
    .upload(path, image, { contentType: image.type, upsert: true });

  if (uploadError) redirect(`${returnPath}?media=logo-error`);

  const { data: updatedSchool, error: schoolError } = await supabase
    .from("schools")
    .update({ logo_path: path })
    .eq("id", schoolId)
    .select("id")
    .maybeSingle();

  if (schoolError || !updatedSchool) redirect(`${returnPath}?media=logo-error`);
  revalidatePath(`/schools/${schoolId}`);
  revalidatePath(`/schools/${schoolId}/setup`);
  redirect(`${returnPath}?media=logo-updated`);
}
