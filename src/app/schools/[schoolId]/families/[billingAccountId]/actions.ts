"use server";

import { redirect } from "next/navigation";
import { createFamilyCardSetup } from "@/lib/stripe/payment-methods";
import { createClient } from "@/lib/supabase/server";

export async function startFamilyCardSetup(schoolId: string, billingAccountId: string) {
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=${path}`);

  const { data: membership, error } = await supabase.from("school_members").select("role")
    .eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle();
  if (error || !membership || !["owner", "admin"].includes(membership.role)) redirect(path);

  let destination = `${path}?card=error`;
  try {
    destination = await createFamilyCardSetup(schoolId, billingAccountId, profileId);
  } catch (setupError) {
    console.error("Family card setup could not start", setupError);
  }
  redirect(destination);
}
