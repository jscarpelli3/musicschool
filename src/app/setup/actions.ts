"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";

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
  try {
    await protectServerAction({ scope: "school.create", subject: `actor:${claims.claims.sub}`, limit: 3, windowSeconds: 86400, blockSeconds: 3600 });
  } catch (caught) {
    return { error: caught instanceof RequestBoundaryError && caught.code === "rate_limited"
      ? "Too many school-creation attempts were made. Wait before trying again."
      : "This request could not be validated. Reload and try again." };
  }

  const { data: schoolId, error } = await supabase.rpc("create_school", {
    school_name: name,
    school_timezone: timezone,
  });

  if (error || !schoolId) {
    return { error: error?.message.includes("school_onboarding_invitation_required")
      ? "This account does not have an active beta invitation. Ask Common Time to confirm the email address on your invitation."
      : "The school could not be created. Nothing was changed; try again." };
  }

  redirect(`/schools/${schoolId}`);
}
