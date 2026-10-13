"use client";

import { useFormStatus } from "react-dom";

export function StripeActionButton({
  idleLabel,
  pendingLabel,
  tone = "primary",
}: {
  idleLabel: string;
  pendingLabel: string;
  tone?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  const classes = tone === "primary"
    ? "border-brand text-brand hover:bg-brand hover:text-surface"
    : "border-line text-ink hover:border-brand hover:text-brand";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex w-full items-center justify-center gap-2 border px-5 py-3 text-sm transition disabled:cursor-wait disabled:opacity-60 sm:w-auto ${classes}`}
    >
      {pending ? <span className="h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" aria-hidden="true" /> : null}
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
