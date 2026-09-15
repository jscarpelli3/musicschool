"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { reportOwnerNotificationEmailProblem, retryOwnerNotificationEmail } from "./actions";

type Notice = Database["public"]["Tables"]["owner_notifications"]["Row"];
type FailedEmail = Pick<Database["public"]["Tables"]["owner_notification_email_outbox"]["Row"], "id" | "subject" | "failed_at" | "retry_count" | "retry_not_before">;
type Toast = { title: string; message: string; href?: string; notice?: Notice };

export function OwnerNotifications({ schoolId, embedded = false }: { schoolId: string; embedded?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
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
      setToast({ title: notice.title, message: notice.message, href: notice.href, notice });
      router.refresh();
    }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [router, schoolId, supabase]);

  useEffect(() => {
    const showToast = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; message?: string; href?: string }>).detail;
      if (!detail?.title || !detail.message) return;
      setToast({ title: detail.title, message: detail.message, href: detail.href });
    };
    window.addEventListener("common-time:toast", showToast);
    return () => window.removeEventListener("common-time:toast", showToast);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("common-time:open-approvals", close);
    window.addEventListener("common-time:open-invoices", close);
    return () => { window.removeEventListener("common-time:open-approvals", close); window.removeEventListener("common-time:open-invoices", close); };
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
    <div className={embedded ? "notification-control relative z-[90] flex flex-col items-end" : "fixed right-5 top-5 z-[90]"}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => { if (!value) window.dispatchEvent(new Event("common-time:open-notifications")); return !value; })} className="rounded-control border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm text-brand transition hover:border-brand hover:bg-brand/15">Notifications{unread ? <span className="ml-2 inline-grid min-w-5 place-items-center rounded-full bg-brand px-1 text-xs text-canvas" aria-label={`${unread} unread notifications`}>{unread}</span> : null}</button>
      {embedded ? <Link href={`/schools/${schoolId}/notifications`} className="mt-0.5 text-[10px] leading-none text-muted hover:text-ink">View all</Link> : null}
      {open ? <div className={`ui-card mt-2 w-[min(24rem,calc(100vw-2.5rem))] p-4 ${embedded ? "absolute top-full right-0" : ""}`}><div className="flex items-center justify-between"><p className="font-display text-2xl">Notifications</p><button onClick={() => setOpen(false)} className="text-sm text-muted">Close</button></div><div className="mt-4 max-h-[60vh] overflow-y-auto">{failedEmails.map((delivery) => { const retryAt = delivery.retry_not_before ? new Date(delivery.retry_not_before) : null; const coolingDown = retryAt ? retryAt.getTime() > clock : false; const reported = reportedDeliveryIds.has(delivery.id); return <div key={delivery.id} className="border-l-2 border-danger bg-danger/5 p-3 text-sm"><p>Email alert needs attention</p><p className="mt-1 text-xs text-muted">{delivery.subject}{delivery.failed_at ? ` · ${new Date(delivery.failed_at).toLocaleString()}` : ""}</p>{coolingDown ? <p className="mt-2 text-xs text-muted">Retry available {retryAt?.toLocaleTimeString()}</p> : null}<div className="mt-3 flex flex-wrap gap-3"><button type="button" disabled={retryingId === delivery.id || coolingDown || delivery.retry_count >= 5} onClick={() => void retryEmail(delivery.id)} className="border border-danger px-3 py-2 text-xs text-danger disabled:opacity-50">{retryingId === delivery.id ? "Retrying…" : delivery.retry_count >= 5 ? "Retry limit reached" : "Retry email"}</button><button type="button" disabled={reported || reportingId === delivery.id} onClick={() => void reportProblem(delivery.id)} className="border-b border-muted px-2 py-2 text-xs text-muted disabled:opacity-60">{reported ? "Problem reported" : reportingId === delivery.id ? "Reporting…" : "Report email problem"}</button></div></div>; })}{retryMessage ? <p role="status" className="py-3 text-xs text-muted">{retryMessage}</p> : null}{notices.length ? notices.map((notice) => <Link key={notice.id} href={notice.href} onClick={() => void markRead(notice)} className={`block rounded-control px-3 py-3 transition hover:bg-brand/10 ${notice.read_at ? "text-muted" : "text-ink"}`}><p className="text-sm">{notice.title}</p><p className="mt-1 text-xs leading-5 text-muted">{notice.message}</p></Link>) : <p className="py-6 text-sm text-muted">No notifications yet.</p>}</div></div> : null}
    </div>
    {toast ? <div role="status" className="fixed bottom-5 right-5 z-[100] w-[min(26rem,calc(100vw-2.5rem))] border border-brand bg-canvas p-5"><button onClick={() => setToast(null)} className="float-right text-xs text-muted">Dismiss</button><p className="pr-16 font-display text-2xl">{toast.title}</p><p className="mt-2 text-sm leading-6 text-muted">{toast.message}</p>{toast.href ? <Link href={toast.href} onClick={() => { if (toast.notice) void markRead(toast.notice); setToast(null); }} className="mt-4 inline-block border-b border-brand pb-1 text-sm text-brand">Open record →</Link> : null}</div> : null}
  </>;
}
