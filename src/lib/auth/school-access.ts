import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadMySchoolCapabilities } from "@/lib/auth/school-capabilities";

export const loadCurrentSchoolAccess = cache(async function loadCurrentSchoolAccess(schoolId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return { profileId: null, school: null, membership: null, capabilities: new Set() };

  const [{ data: school }, { data: membership }, capabilities] = await Promise.all([
    supabase.from("schools").select("id,name,slug,timezone,family_billing_mode,logo_path,theme_key,font_key").eq("id", schoolId).maybeSingle(),
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    loadMySchoolCapabilities(schoolId),
  ]);

  return { profileId, school, membership, capabilities };
});
