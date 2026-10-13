"use client";

import { useFormStatus } from "react-dom";

export function PaymentCodeSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="mt-6 inline-flex items-center gap-2 rounded-control bg-brand px-5 py-3 text-sm text-canvas hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-r-transparent" /> : null}
      {pending ? "Creating secure payment code…" : "Create payment QR code"}
    </button>
  );
}
