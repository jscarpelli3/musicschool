import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const EXISTING_USER_CODES = new Set(["email_exists", "user_already_exists"]);

export async function ensurePortalAuthIdentity(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true });

  if (!createError) {
    if (!created.user?.id) throw new Error("Created portal identity could not be resolved.");
    return created.user.id;
  }
  if (!EXISTING_USER_CODES.has(createError.code ?? "") && !/already (been )?registered|already exists/i.test(createError.message)) {
    throw createError;
  }

  const { data: userId, error: lookupError } = await admin.rpc("get_portal_auth_user_id_by_email", { p_email: email });
  if (lookupError || !userId) throw lookupError ?? new Error("Existing portal identity could not be resolved.");

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
  if (updateError) throw updateError;
  return userId;
}
