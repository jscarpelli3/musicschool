"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCalendarSubscription, revokeCalendarSubscription } from "./calendar-actions";

type CalendarSubscriptionProps = {
  schoolId: string;
  schoolName: string;
  active: boolean;
};

export function CalendarSubscription({ schoolId, schoolName, active }: CalendarSubscriptionProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedUrl, setFeedUrl] = useState("");
  const [message, setMessage] = useState("");

  function subscribe() {
    startTransition(async () => {
      setMessage("");
      const result = await createCalendarSubscription(schoolId);
      if (!result.ok) return setMessage(result.message);
      const url = `${window.location.origin}/api/calendar/${result.token}`;
      setFeedUrl(url);
      router.refresh();
    });
  }

  function openCalendar() {
    window.location.href = feedUrl.replace(/^https?:/, "webcal:");
  }

  function copyLink() {
    startTransition(async () => {
      await navigator.clipboard.writeText(feedUrl);
      setMessage("Private calendar link copied.");
    });
  }

  function revoke() {
    startTransition(async () => {
      setMessage("");
      const result = await revokeCalendarSubscription(schoolId);
      if (!result.ok) return setMessage(result.message);
      setFeedUrl("");
      setMessage("Calendar access removed. Existing calendar apps will stop receiving updates.");
      router.refresh();
    });
  }

  return <aside className="border-y border-line py-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm text-ink">Lesson calendar</h3>
        <p className="mt-1 max-w-xl text-xs leading-5 text-muted">Subscribe once. {schoolName} lessons, cancellations, and time changes will update in your calendar automatically.</p>
      </div>
      {!feedUrl ? <button type="button" disabled={pending} onClick={subscribe} className="shrink-0 border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas disabled:opacity-50">{pending ? "Creating…" : active ? "Get a new private link" : "Subscribe to calendar"}</button> : null}
    </div>
    {feedUrl ? <div className="mt-5 border-l-2 border-brand pl-4">
      <p className="text-sm">Your private calendar is ready.</p>
      <p className="mt-1 text-xs leading-5 text-muted">Opening it usually launches the calendar app on this device. Keep the link private—anyone with it can see these lesson details.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={openCalendar} className="border border-brand bg-brand px-4 py-2 text-sm text-canvas">Open calendar app</button>
        <button type="button" onClick={copyLink} className="border border-line px-4 py-2 text-sm text-muted hover:text-ink">Copy private link</button>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted">For Google Calendar, copy the link and use Other calendars → From URL on a computer. For Outlook on the web, use Add calendar → Subscribe from web. Calendar providers control refresh timing, so a change may take several hours to appear.</p>
    </div> : active ? <p className="mt-4 text-xs leading-5 text-muted">A subscription is active. Creating a new private link disables the old one.</p> : null}
    {active ? <button type="button" disabled={pending} onClick={revoke} className="mt-4 text-xs text-muted underline underline-offset-4 hover:text-ink disabled:opacity-50">Remove calendar access</button> : null}
    {message ? <p role="status" className="mt-4 text-xs leading-5 text-muted">{message}</p> : null}
  </aside>;
}
