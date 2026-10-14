"use client";

import { useEffect } from "react";

export function ScrollToInvoice({ invoiceId }: { invoiceId?: string }) {
  useEffect(() => {
    if (!invoiceId) return;
    const frame = requestAnimationFrame(() => document.getElementById(`invoice-${invoiceId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return () => cancelAnimationFrame(frame);
  }, [invoiceId]);
  return null;
}
