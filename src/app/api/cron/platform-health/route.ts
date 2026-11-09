import type { SupabaseClient } from "@supabase/supabase-js";
import { platformIncidentAlertEmail } from "@/lib/resend/platform-incident-alert-email";
import { schoolEmailSender } from "@/lib/resend/email-security";
import { ResendRequestError, ResendUnknownOutcomeError, sendResendEmail } from "@/lib/resend/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Incident = { id: string; alert_cycle: number; title: string; summary: string; provider: string; last_seen_at: string };
type AdminRow = { profile_id: string };
type ProfileRow = { id: string; email: string | null };
type AlertRow = { id: string; status: string; attempt_count: number };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const admin = createAdminClient() as unknown as SupabaseClient;
  const scan = await admin.rpc("scan_platform_health_incidents");
  if (scan.error) {
    console.error("Platform health scan failed", { code: scan.error.code });
    return Response.json({ ok: false, error: "health_scan_failed" }, { status: 500 });
  }

  const [{ data: incidents, error: incidentError }, { data: adminRows, error: adminError }] = await Promise.all([
    admin.from("platform_incidents").select("id,alert_cycle,title,summary,provider,last_seen_at").eq("status", "open").eq("severity", "urgent").order("last_seen_at", { ascending: true }).limit(25),
    admin.from("platform_admins").select("profile_id").eq("status", "active"),
  ]);
  if (incidentError || adminError) {
    console.error("Platform alert candidate query failed", { incidentCode: incidentError?.code, adminCode: adminError?.code });
    return Response.json({ ok: false, error: "alert_candidate_query_failed" }, { status: 500 });
  }
  const profileIds = ((adminRows ?? []) as AdminRow[]).map((row) => row.profile_id);
  const { data: profiles, error: profileError } = profileIds.length
    ? await admin.from("profiles").select("id,email").in("id", profileIds)
    : { data: [], error: null };
  if (profileError) return Response.json({ ok: false, error: "alert_recipient_query_failed" }, { status: 500 });

  const recipients = ((profiles ?? []) as ProfileRow[]).flatMap((profile) => {
    const email = profile.email?.trim().toLowerCase();
    return email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? [{ profileId: profile.id, email }] : [];
  });
  const origin = (process.env.APP_URL ?? "https://app.commontime.studio").replace(/\/$/, "");
  let accepted = 0;
  let failed = 0;
  let skipped = 0;
  for (const incident of (incidents ?? []) as Incident[]) {
    for (const recipient of recipients) {
      const existing = await admin.from("platform_incident_alert_deliveries")
        .select("id,status,attempt_count").eq("incident_id", incident.id).eq("alert_cycle", incident.alert_cycle).eq("recipient_email", recipient.email).maybeSingle();
      if (existing.error) { failed += 1; continue; }
      const current = existing.data as AlertRow | null;
      if (current?.status === "accepted" || current?.status === "reconciliation_required" || (current?.attempt_count ?? 0) >= 3) { skipped += 1; continue; }
      let delivery=current;
      if(!delivery){
        const inserted=await admin.from("platform_incident_alert_deliveries").insert({
          incident_id: incident.id, alert_cycle: incident.alert_cycle, recipient_profile_id: recipient.profileId, recipient_email: recipient.email,
        }).select("id,status,attempt_count").single();
        if(inserted.error){failed+=1;continue;}
        delivery=inserted.data as AlertRow|null;
      }
      if (!delivery) { failed += 1; continue; }
      const message = platformIncidentAlertEmail({
        title: incident.title, summary: incident.summary, provider: incident.provider, incidentId: incident.id,
        adminUrl: `${origin}/admin#platform-incidents`,
        occurredAt: new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" }).format(new Date(incident.last_seen_at)),
      });
      try {
        const result = await sendResendEmail({
          from: schoolEmailSender("Common Time Platform"), to: recipient.email, subject: message.subject, text: message.text, html: message.html,
          idempotencyKey: `platform-incident-${incident.id}-${incident.alert_cycle}-${recipient.profileId}`, messageKind: "platform_incident", timeoutMs: 10_000,
        });
        await admin.from("platform_incident_alert_deliveries").update({ status: "accepted", provider_email_id: result.id, attempt_count: delivery.attempt_count + 1, last_attempted_at: new Date().toISOString(), accepted_at: new Date().toISOString(), last_error_code: null }).eq("id", delivery.id);
        accepted += 1;
      } catch (caught) {
        const unknown = caught instanceof ResendUnknownOutcomeError;
        const provider = caught instanceof ResendRequestError ? caught : null;
        await admin.from("platform_incident_alert_deliveries").update({ status: unknown ? "reconciliation_required" : "failed", attempt_count: delivery.attempt_count + 1, last_attempted_at: new Date().toISOString(), last_error_code: provider?.code ?? (provider?.status ? String(provider.status) : unknown ? "provider_outcome_unknown" : "request_failed") }).eq("id", delivery.id);
        failed += 1;
      }
    }
  }
  return Response.json({ ok: failed === 0, scanned: scan.data ?? 0, urgent: incidents?.length ?? 0, recipients: recipients.length, accepted, failed, skipped }, { status: failed === 0 ? 200 : 207 });
}
