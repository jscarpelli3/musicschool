import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"), request.nextUrl.origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await supabase.rpc("activate_my_teacher_memberships");
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error("Supabase OAuth code exchange failed", {
      code: error.code ?? "unknown",
      status: error.status ?? "unknown",
      name: error.name,
    });
  } else {
    const providerError = request.nextUrl.searchParams.get("error_code")
      ?? request.nextUrl.searchParams.get("error");
    console.error("Supabase OAuth callback missing code", {
      providerError: providerError && /^[a-z0-9_.-]{1,80}$/i.test(providerError) ? providerError : "unknown",
    });
  }

  return NextResponse.redirect(new URL("/login?error=auth", request.url));
}
