import { NextResponse } from "next/server";
import { synchronizeStripeConnection } from "@/lib/stripe/connections";
import { getStripeMode } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  const target = new URL(`/schools/${schoolId}/payments`, request.url);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const profileId = auth?.claims?.sub;
  if (!profileId) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(target.pathname)}`, request.url));

  const [{ data: membership }, { data: connection, error }] = await Promise.all([
    supabase.from("school_members").select("role").eq("school_id", schoolId).eq("profile_id", profileId).eq("status", "active").maybeSingle(),
    supabase.from("school_payment_connections").select("provider_account_id").eq("school_id", schoolId).eq("provider", "stripe").eq("livemode", getStripeMode() === "live").maybeSingle(),
  ]);
  if (!membership || !["owner", "admin"].includes(membership.role)) return NextResponse.redirect(new URL(`/schools/${schoolId}`, request.url));

  try {
    if (error || !connection?.provider_account_id) throw error ?? new Error("No Stripe connection exists.");
    const { account } = await synchronizeStripeConnection(schoolId, connection.provider_account_id, profileId);
    target.searchParams.set("stripe", account.charges_enabled && account.payouts_enabled ? "ready" : "returned-synced");
  } catch (syncError) {
    console.error("Stripe return synchronization failed", syncError);
    target.searchParams.set("stripe", "sync-error");
  }
  return NextResponse.redirect(target);
}
