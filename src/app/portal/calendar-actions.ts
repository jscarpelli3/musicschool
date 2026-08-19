"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createCalendarSubscription(schoolId: string) {
  if (!UUID_PATTERN.test(schoolId)) return { ok: false as const, message: "That school could not be verified." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false as const, message: "Sign in again to subscribe." };
  const { data: token, error } = await supabase.rpc("rotate_client_portal_calendar_subscription", { p_school_id: schoolId });
  if (error || !token) return { ok: false as const, message: "The private calendar link could not be created." };
  revalidatePath("/portal");
  return { ok: true as const, token };
}

export async function revokeCalendarSubscription(schoolId: string) {
  if (!UUID_PATTERN.test(schoolId)) return { ok: false as const, message: "That school could not be verified." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false as const, message: "Sign in again to change this calendar." };
  const { error } = await supabase.rpc("revoke_client_portal_calendar_subscription", { p_school_id: schoolId });
  if (error) return { ok: false as const, message: "The private calendar link could not be removed." };
  revalidatePath("/portal");
  return { ok: true as const };
}
