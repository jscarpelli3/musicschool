"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { retryOwnerNotificationEmail } from "./actions";

type Notice = Database["public"]["Tables"]["owner_notifications"]["Row"];
type FailedEmail = Pick<Database["public"]["Tables"]["owner_notification_email_outbox"]["Row"], "id" | "subject" | "failed_at">;

export function OwnerNotifications() {
  const pathname = usePathname();
  const schoolId = pathname.match(/^\/schools\/([0-9a-f-]{36})(?:\/|$)/i)?.[1];
  const supabase = useMemo(() => createClient(), []);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Notice | null>(null);
  const [failedEmails, setFailedEmails] = useState<FailedEmail[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState("");

  useEffect(() => {
    if (!schoolId) return;
    let active = true;
    void Promise.all([
      supabase.from("owner_notifications").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(20),
      supabase.from("owner_notification_email_outbox").select("id, subject, failed_at").eq("school_id", schoolId).eq("status", "failed").order("failed_at", { ascending: false }).limit(10),
    ]).then(([noticeResult, failedResult]) => { if (active) { setNotices(noticeResult.data ?? []); setFailedEmails(failedResult.data ?? []); } });
    const channel = supabase.channel(`owner-notifications:${schoolId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "owner_notifications", filter: `school_id=eq.${schoolId}` }, (payload) => {
      const notice = payload.new as Notice;
      setNotices((current) => [notice, ...current.filter((item) => item.id !== notice.id)].slice(0, 20));
      setToast(notice);
    }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [schoolId, supabase]);

  if (!schoolId) return null;
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

  return <>
    <div className="fixed right-5 top-5 z-[90]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="border border-line bg-canvas px-4 py-2 text-sm text-ink">Notifications{unread ? ` · ${unread}` : ""}</button>
      {open ? <div className="mt-2 w-[min(24rem,calc(100vw-2.5rem))] border border-line bg-canvas p-4 shadow-xl"><div className="flex items-center justify-between"><p className="font-display text-2xl">Notifications</p><button onClick={() => setOpen(false)} className="text-sm text-muted">Close</button></div><div className="mt-4 max-h-[60vh] overflow-y-auto">{failedEmails.map((delivery) => <div key={delivery.id} className="border-l-2 border-danger bg-danger/5 p-3 text-sm"><p>Email alert needs attention</p><p className="mt-1 text-xs text-muted">{delivery.subject}{delivery.failed_at ? ` · ${new Date(delivery.failed_at).toLocaleString()}` : ""}</p><button type="button" disabled={retryingId === delivery.id} onClick={() => void retryEmail(delivery.id)} className="mt-3 border border-danger px-3 py-2 text-xs text-danger disabled:opacity-50">{retryingId === delivery.id ? "Retrying…" : "Retry email"}</button></div>)}{retryMessage ? <p role="status" className="py-3 text-xs text-muted">{retryMessage}</p> : null}{notices.length ? notices.map((notice) => <Link key={notice.id} href={notice.href} onClick={() => void markRead(notice)} className={`block border-t border-line py-4 first:border-t-0 ${notice.read_at ? "text-muted" : "text-ink"}`}><p className="text-sm">{notice.title}</p><p className="mt-1 text-xs leading-5 text-muted">{notice.message}</p></Link>) : <p className="py-6 text-sm text-muted">No notifications yet.</p>}</div></div> : null}
    </div>
    {toast ? <div role="status" className="fixed bottom-5 right-5 z-[100] w-[min(26rem,calc(100vw-2.5rem))] border border-brand bg-canvas p-5"><button onClick={() => setToast(null)} className="float-right text-xs text-muted">Dismiss</button><p className="pr-16 font-display text-2xl">{toast.title}</p><p className="mt-2 text-sm leading-6 text-muted">{toast.message}</p><Link href={toast.href} onClick={() => { void markRead(toast); setToast(null); }} className="mt-4 inline-block border-b border-brand pb-1 text-sm text-brand">Open billing record →</Link></div> : null}
  </>;
}
