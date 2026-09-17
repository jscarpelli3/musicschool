"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function PaymentStatusRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [router]);
  return <p role="status" className="mt-3 text-xs text-muted">Waiting for Stripe confirmation…</p>;
}
