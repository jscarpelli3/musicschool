import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { synchronizeStripeConnection } from "@/lib/stripe/connections";
import { expireCardSetup, reconcileCompletedCardSetup } from "@/lib/stripe/payment-method-reconciliation";
import { getStripe, getStripeWebhookSecrets } from "@/lib/stripe/server";
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

type VerifiedEvent = {
  id: string;
  type: string;
  livemode: boolean;
  accountId: string | null;
  objectId: string | null;
  apiVersion: string | null;
  createdAt: string;
  payload: Json;
  accountEvent: boolean;
  checkoutSetupEvent: "completed" | "expired" | null;
};

async function verifyEvent(rawBody: string, signature: string): Promise<VerifiedEvent> {
  const stripe = getStripe();
  const parsed = JSON.parse(rawBody) as { object?: string };
  let lastVerificationError: unknown;

  for (const secret of getStripeWebhookSecrets()) {
    try {
      if (parsed.object === "v2.core.event") {
        const notification = await stripe.parseEventNotificationAsync(rawBody, signature, secret);
        const related = "related_object" in notification ? notification.related_object : null;
        const accountEvent = notification.type === "v2.core.account.created"
          || notification.type === "v2.core.account.updated"
          || notification.type.startsWith("v2.core.account[");
        return {
          id: notification.id,
          type: notification.type,
          livemode: notification.livemode,
          accountId: accountEvent ? related?.id ?? null : null,
          objectId: related?.id ?? null,
          apiVersion: null,
          createdAt: new Date(notification.created).toISOString(),
          payload: parsed as Json,
          accountEvent,
          checkoutSetupEvent: null,
        };
      }

      const event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
      return {
        id: event.id,
        type: event.type,
        livemode: event.livemode,
        accountId: providerAccountId(event),
        objectId: providerObjectId(event),
        apiVersion: event.api_version ?? null,
        createdAt: new Date(event.created * 1000).toISOString(),
        payload: event as unknown as Json,
        accountEvent: event.type === "account.updated",
        checkoutSetupEvent: event.type === "checkout.session.completed"
          ? "completed"
          : event.type === "checkout.session.expired" ? "expired" : null,
      };
    } catch (error) {
      lastVerificationError = error;
    }
  }

  throw lastVerificationError ?? new Error("No Stripe webhook signing secrets are configured.");
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });

  const rawBody = await request.text();
  let event: VerifiedEvent;
  try {
    event = await verifyEvent(rawBody, signature);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  const admin = createAdminClient();
  const accountId = event.accountId;
  const { error: intakeError } = await admin.from("payment_provider_events").upsert({
    provider: "stripe",
    provider_event_id: event.id,
    livemode: event.livemode,
    provider_account_id: accountId,
    event_type: event.type,
    provider_object_id: event.objectId,
    api_version: event.apiVersion,
    payload: event.payload,
    provider_created_at: event.createdAt,
  }, { onConflict: "provider_event_id", ignoreDuplicates: true });
  if (intakeError) {
    console.error("Stripe webhook intake failed", intakeError);
    return NextResponse.json({
      error: "Event intake failed.",
      ...(process.env.STRIPE_MODE === "test" ? { code: intakeError.code, detail: intakeError.message } : {}),
    }, { status: 500 });
  }

  const { data: claimed, error: claimError } = await admin.rpc("claim_payment_provider_event", {
    p_provider_event_id: event.id,
    p_stale_after_seconds: 300,
  })
    .maybeSingle();
  if (claimError) return NextResponse.json({ error: "Event claim failed." }, { status: 500 });
  if (!claimed) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (event.accountEvent && accountId) {
      const { data: connection, error } = await admin.from("school_payment_connections")
        .select("school_id")
        .eq("provider", "stripe")
        .eq("provider_account_id", accountId)
        .maybeSingle();
      if (error || !connection) throw error ?? new Error(`No school connection found for ${accountId}.`);
      await synchronizeStripeConnection(connection.school_id, accountId, null);
    }

    if (event.checkoutSetupEvent === "completed" && accountId && event.objectId) {
      await reconcileCompletedCardSetup(event.objectId, accountId, event.createdAt);
    } else if (event.checkoutSetupEvent === "expired" && event.objectId) {
      await expireCardSetup(event.objectId);
    }

    const supported = event.accountEvent || Boolean(event.checkoutSetupEvent);
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
