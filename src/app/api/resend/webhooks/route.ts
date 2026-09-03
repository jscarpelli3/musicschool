import "server-only";

import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; to?: string[] };
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 262_144) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const rawBody = await request.text();
  if (rawBody.length > 262_144) return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  const eventId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!eventId || !timestamp || !signature) return NextResponse.json({ error: "Missing signature headers." }, { status: 400 });

  let event: ResendEvent;
  try {
    event = new Webhook(secret).verify(rawBody, {
      "svix-id": eventId,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid Resend signature." }, { status: 400 });
  }

  const providerEmailId = event.data?.email_id;
  const occurredAt = event.created_at;
  if (!event.type || !providerEmailId || !occurredAt || Number.isNaN(Date.parse(occurredAt))) {
    return NextResponse.json({ error: "Unsupported event payload." }, { status: 400 });
  }
  const recipient = event.data?.to?.[0]?.trim().toLowerCase() || undefined;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_resend_delivery_event", {
    p_event_type: event.type,
    p_occurred_at: occurredAt,
    p_provider_email_id: providerEmailId,
    p_provider_event_id: eventId,
    p_recipient_email: recipient,
  });
  if (error) {
    console.error("Resend webhook reconciliation failed", { code: error.code, eventId });
    return NextResponse.json({ error: "Event intake failed." }, { status: 500 });
  }
  if (data === "pending_reconciliation") {
    const status = ({
      "email.sent": "sent", "email.delivered": "delivered", "email.delivery_delayed": "delayed",
      "email.bounced": "bounced", "email.complained": "complained", "email.failed": "failed", "email.suppressed": "suppressed",
    } as Record<string, string>)[event.type];
    if (status) {
      const occurred = new Date(occurredAt).toISOString();
      const failed = ["bounced", "complained", "failed", "suppressed"].includes(status);
      const ownerUpdate = await admin.from("owner_notification_email_outbox").update({
        status,
        delivered_at: status === "delivered" ? occurred : undefined,
        failed_at: failed ? occurred : undefined,
      }).eq("provider_email_id", providerEmailId);
      const lessonUpdate = await admin.from("lesson_created_email_outbox").update({
        status,
        delivered_at: status === "delivered" ? occurred : undefined,
        failed_at: failed ? occurred : undefined,
        updated_at: occurred,
      }).eq("provider_email_id", providerEmailId);
      if (ownerUpdate.error || lessonUpdate.error) {
        console.error("Resend webhook fallback reconciliation failed", { eventId, ownerCode: ownerUpdate.error?.code, lessonCode: lessonUpdate.error?.code });
        return NextResponse.json({ error: "Event reconciliation failed." }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ received: true, duplicate: data === "duplicate" });
}
