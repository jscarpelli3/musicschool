"use server";

import { redirect } from "next/navigation";
import { createFamilyCardSetup } from "@/lib/stripe/payment-methods";
import { createClient } from "@/lib/supabase/server";

export type CardSetupLinkState = { url: string | null; error: string | null };

export async function generateFamilyCardSetupLink(
  schoolId: string,
  billingAccountId: string,
  previous: CardSetupLinkState,
): Promise<CardSetupLinkState> {
  void previous;
  const path = `/schools/${schoolId}/families/${billingAccountId}`;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) redirect(`/login?next=${path}`);

  const { data: membership, error } = await supabase.from("school_members").select("role")
    .eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle();
  if (error || !membership || !["owner", "admin"].includes(membership.role)) {
    return { url: null, error: "You do not have permission to create a setup link." };
  }

  try {
    const url = await createFamilyCardSetup(schoolId, billingAccountId, profileId);
    return { url, error: null };
  } catch (setupError) {
    console.error("Family card setup could not start", setupError);
    return { url: null, error: "Secure card setup could not start. No card information was collected." };
  }
}
