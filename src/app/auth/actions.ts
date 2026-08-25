"use server";

import { protectServerAction, RequestBoundaryError } from "@/lib/security/request-boundary";
import { createClient } from "@/lib/supabase/server";

type AuthResult = { ok: boolean; message: string; accessState?: "ready" | "ambiguous" | "not_setup" };

const validEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && value.length <= 320;

export async function requestEmailCode(emailValue: string, audience: "account" | "portal"): Promise<AuthResult> {
  const email = emailValue.trim().toLowerCase();
  if (!validEmail(email)) return { ok: false, message: "Enter a valid email address." };
  try {
    await protectServerAction({ scope: `auth.code.request.${audience}`, subject: `email:${email}`, limit: 5, windowSeconds: 900, blockSeconds: 900 });
  } catch (caught) {
    if (caught instanceof RequestBoundaryError && caught.code === "rate_limited") return { ok: false, message: "Too many code requests. Wait 15 minutes and try again." };
    return { ok: false, message: "This request could not be validated. Reload and try again." };
  }
  const supabase = await createClient();
  if (audience === "portal") {
    const { data: accessState,error } = await supabase.rpc("client_portal_email_access_state", { p_email: email });
    if (error) return { ok: false, message: "Portal access could not be checked. Wait a moment and try again." };
    if (accessState === "not_setup") return { ok: false, accessState, message: "Your family portal has not been set up yet. Check the email address or contact your school for help." };
    if (accessState === "ambiguous") return { ok: false, accessState, message: "More than one family account uses this email. Please contact the school for help." };
  }
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) return { ok: false, message: audience === "portal" ? "We could not send a sign-in code. Wait a moment and try again." : "We could not send a code for that email. Ask the school to confirm your access." };
  return { ok: true, message: "If this email can sign in, a one-time code is on its way." };
}

export async function verifyEmailCode(emailValue: string, codeValue: string): Promise<AuthResult> {
  const email = emailValue.trim().toLowerCase();
  const code = codeValue.replace(/\s/g, "");
  if (!validEmail(email) || !/^\d{6,8}$/.test(code)) return { ok: false, message: "Check the code and try again." };
  try {
    await protectServerAction({ scope: "auth.code.verify", subject: `email:${email}`, limit: 10, windowSeconds: 900, blockSeconds: 900 });
  } catch (caught) {
    if (caught instanceof RequestBoundaryError && caught.code === "rate_limited") return { ok: false, message: "Too many attempts. Wait 15 minutes, then request a new code." };
    return { ok: false, message: "This request could not be validated. Reload and try again." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) return { ok: false, message: "That code is invalid or expired. Request a new one and try again." };
  const { error: activationError } = await supabase.rpc("activate_my_teacher_memberships");
  if (activationError) console.error("Teacher membership activation failed after sign-in", { code: activationError.code });
  return { ok: true, message: "Signed in." };
}
