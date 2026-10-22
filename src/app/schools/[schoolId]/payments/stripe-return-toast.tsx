"use client";

import { useEffect } from "react";

export function StripeReturnToast({ title, message }: { title: string; message: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("common-time:toast", { detail: { title, message } }));
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [message, title]);

  return null;
}
