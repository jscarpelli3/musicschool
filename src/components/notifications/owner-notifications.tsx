"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { reportOwnerNotificationEmailProblem, retryOwnerNotificationEmail } from "./actions";

type Notice = Database["public"]["Tables"]["owner_notifications"]["Row"];
type FailedEmail = Pick<Database["public"]["Tables"]["owner_notification_email_outbox"]["Row"], "id" | "subject" | "failed_at" | "retry_count" | "retry_not_before">;

export function OwnerNotifications({ schoolId, embedded = false }: { schoolId: string; embedded?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Notice | null>(null);
  const [failedEmails, setFailedEmails] = useState<FailedEmail[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState("");
  const [reportedDeliveryIds, setReportedDeliveryIds] = useState<Set<string>>(new Set());
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (!schoolId) return;
    let active = true;
    void Promise.all([
      supabase.from("owner_notifications").select("*").eq("school_id", schoolId).is("archived_at", null).gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()).order("created_at", { ascending: false }).limit(20),
      supabase.from("owner_notification_email_outbox").select("id, subject, failed_at, retry_count, retry_not_before").eq("school_id", schoolId).eq("status", "failed").order("failed_at", { ascending: false }).limit(10),
      supabase.from("platform_support_incidents").select("source_id").eq("school_id", schoolId).eq("source_type", "owner_notification_email_outbox").in("status", ["open", "acknowledged"]),
    ]).then(([noticeResult, failedResult, incidentResult]) => { if (active) { setNotices(noticeResult.data ?? []); setFailedEmails(failedResult.data ?? []); setReportedDeliveryIds(new Set((incidentResult.data ?? []).map((item) => item.source_id))); } });
    const channel = supabase.channel(`owner-notifications:${schoolId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "owner_notifications", filter: `school_id=eq.${schoolId}` }, (payload) => {
      const notice = payload.new as Notice;
      setNotices((current) => [notice, ...current.filter((item) => item.id !== notice.id)].slice(0, 20));
      setToast(notice);
    }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [schoolId, supabase]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const unread = notices.filter((notice) => !notice.read_at).length;
  async function markRead(notice: Notice) {
    if (!notice.read_at) {
      const readAt = new Date().toISOString();
      setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, read_at: readAt } : item));
      await supabase.from("owner_notifications").update({ read_at: readAt }).eq("id", notice.id);
    }
    setOpen(false);
  }
  async function retryEmail(deliveryId: string) {
    setRetryingId(deliveryId);
    setRetryMessage("");
    const result = await retryOwnerNotificationEmail(deliveryId);
    if (result.ok) setFailedEmails((current) => current.filter((item) => item.id !== deliveryId));
    setRetryMessage(result.message);
    setRetryingId(null);
  }
  async function reportProblem(deliveryId: string) {
    setReportingId(deliveryId);
    setRetryMessage("");
    const result = await reportOwnerNotificationEmailProblem(deliveryId);
    if (result.ok) setReportedDeliveryIds((current) => new Set(current).add(deliveryId));
    setRetryMessage(result.message);
    setReportingId(null);
  }

  return <>
    <div className={embedded ? "notification-control relative z-[90]" : "fixed right-5 top-5 z-[90]"}>
      <button type="button" onClick={() => setOpen((value) => !value)} className={`text-sm transition ${unread ? "border border-brand bg-brand px-3 py-1.5 text-canvas" : "text-brand hover:text-brand-hover"}`}>Notifications{unread ? <span className="ml-2 inline-grid min-w-5 place-items-center border border-canvas/50 px-1 text-xs" aria-label={`${unread} unread notifications`}>{unread}</span> : null}</button>
      {embedded ? <Link href={`/schools/${schoolId}/notifications`} className="ml-3 text-xs text-muted hover:text-ink">View all</Link> : null}
      {open ? <div className="mt-2 w-[min(24rem,calc(100vw-2.5rem))] border border-line bg-canvas p-4 shadow-xl"><div className="flex items-center justify-between"><p className="font-display text-2xl">Notifications</p><button onClick={() => setOpen(false)} className="text-sm text-muted">Close</button></div><div className="mt-4 max-h-[60vh] overflow-y-auto">{failedEmails.map((delivery) => { const retryAt = delivery.retry_not_before ? new Date(delivery.retry_not_before) : null; const coolingDown = retryAt ? retryAt.getTime() > clock : false; const reported = reportedDeliveryIds.has(delivery.id); return <div key={delivery.id} className="border-l-2 border-danger bg-danger/5 p-3 text-sm"><p>Email alert needs attention</p><p className="mt-1 text-xs text-muted">{delivery.subject}{delivery.failed_at ? ` · ${new Date(delivery.failed_at).toLocaleString()}` : ""}</p>{coolingDown ? <p className="mt-2 text-xs text-muted">Retry available {retryAt?.toLocaleTimeString()}</p> : null}<div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={retryingId === delivery.id || coolingDown || delivery.retry_count >= 5} onClick={() => void retryEmail(delivery.id)} className="border border-danger px-3 py-2 text-xs text-danger disabled:opacity-50">{retryingId === delivery.id ? "Retrying…" : delivery.retry_count >= 5 ? "Retry limit reached" : "Retry email"}</button><button type="button" disabled={reported || reportingId === delivery.id} onClick={() => void reportProblem(delivery.id)} className="border-b border-muted px-2 py-2 text-xs text-muted disabled:opacity-60">{reported ? "Problem reported" : reportingId === delivery.id ? "Reporting…" : "Report email problem"}</button></div></div>; })}{retryMessage ? <p role="status" className="py-3 text-xs text-muted">{retryMessage}</p> : null}{notices.length ? notices.map((notice) => <Link key={notice.id} href={notice.href} onClick={() => void markRead(notice)} className={`block border-t border-line py-4 first:border-t-0 ${notice.read_at ? "text-muted" : "text-ink"}`}><p className="text-sm">{notice.title}</p><p className="mt-1 text-xs leading-5 text-muted">{notice.message}</p></Link>) : <p className="py-6 text-sm text-muted">No notifications yet.</p>}</div></div> : null}
    </div>
    {toast ? <div role="status" className="fixed bottom-5 right-5 z-[100] w-[min(26rem,calc(100vw-2.5rem))] border border-brand bg-canvas p-5"><button onClick={() => setToast(null)} className="float-right text-xs text-muted">Dismiss</button><p className="pr-16 font-display text-2xl">{toast.title}</p><p className="mt-2 text-sm leading-6 text-muted">{toast.message}</p><Link href={toast.href} onClick={() => { void markRead(toast); setToast(null); }} className="mt-4 inline-block border-b border-brand pb-1 text-sm text-brand">Open record →</Link></div> : null}
  </>;
}
