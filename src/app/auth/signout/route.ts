import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertTrustedBrowserRequest, RequestBoundaryError } from "@/lib/security/request-boundary";

export async function POST(request: NextRequest) {
  try { assertTrustedBrowserRequest(request); } catch (caught) {
    if (caught instanceof RequestBoundaryError) return NextResponse.json({ error: "Untrusted request." }, { status: 403 });
    throw caught;
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return NextResponse.json({ error: "Sign out could not be completed." }, { status: 502 });
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
