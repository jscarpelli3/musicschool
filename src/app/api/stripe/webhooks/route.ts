import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { synchronizeStripeConnection } from "@/lib/stripe/connections";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function providerAccountId(event: Stripe.Event) {
  if (event.account) return event.account;
  if (event.type === "account.updated") return (event.data.object as Stripe.Account).id;
  return null;
}

function providerObjectId(event: Stripe.Event) {
  const object = event.data.object as { id?: string };
  return object.id ?? null;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const admin = createAdminClient();
  const accountId = providerAccountId(event);
  const { error: intakeError } = await admin.from("payment_provider_events").upsert({
    provider: "stripe",
    provider_event_id: event.id,
    livemode: event.livemode,
    provider_account_id: accountId,
    event_type: event.type,
    provider_object_id: providerObjectId(event),
    api_version: event.api_version ?? null,
    payload: event as unknown as Json,
    provider_created_at: new Date(event.created * 1000).toISOString(),
  }, { onConflict: "provider_event_id", ignoreDuplicates: true });
  if (intakeError) {
    console.error("Stripe webhook intake failed", intakeError);
    return NextResponse.json({ error: "Event intake failed." }, { status: 500 });
  }

  const { data: claimed, error: claimError } = await admin.from("payment_provider_events")
    .update({ processing_status: "processing", last_error: null })
    .eq("provider_event_id", event.id)
    .in("processing_status", ["received", "failed"])
    .select("id, processing_attempts")
    .maybeSingle();
  if (claimError) return NextResponse.json({ error: "Event claim failed." }, { status: 500 });
  if (!claimed) return NextResponse.json({ received: true, duplicate: true });

  await admin.from("payment_provider_events").update({ processing_attempts: claimed.processing_attempts + 1 }).eq("id", claimed.id);

  try {
    if (event.type === "account.updated" && accountId) {
      const { data: connection, error } = await admin.from("school_payment_connections")
        .select("school_id")
        .eq("provider", "stripe")
        .eq("provider_account_id", accountId)
        .maybeSingle();
      if (error || !connection) throw error ?? new Error(`No school connection found for ${accountId}.`);
      await synchronizeStripeConnection(connection.school_id, accountId, null);
    }

    const supported = event.type === "account.updated";
    const { error: completeError } = await admin.from("payment_provider_events").update({
      processing_status: supported ? "processed" : "ignored",
      processed_at: new Date().toISOString(),
      last_error: null,
    }).eq("id", claimed.id);
    if (completeError) throw completeError;
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Unknown webhook processing failure";
    await admin.from("payment_provider_events").update({ processing_status: "failed", last_error: message }).eq("id", claimed.id);
    console.error("Stripe webhook processing failed", error);
    return NextResponse.json({ error: "Event processing failed." }, { status: 500 });
  }
}
