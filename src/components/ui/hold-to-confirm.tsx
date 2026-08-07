"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./hold-to-confirm.css";

type HoldToConfirmProps = {
  action: () => Promise<{ ok: boolean; message: string }>;
  idleLabel: string;
  holdingLabel?: string;
  duration?: number;
  onSuccess?: () => void;
};

export function HoldToConfirm({
  action,
  idleLabel,
  holdingLabel = "Keep holding…",
  duration = 1400,
  onSuccess,
}: HoldToConfirmProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<"idle" | "holding" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setState((current) => (current === "holding" ? "idle" : current));
  }

  function begin() {
    if (state !== "idle" || timer.current) return;
    setMessage("");
    setState("holding");
    timer.current = setTimeout(async () => {
      timer.current = null;
      setState("submitting");
      try {
        const result = await action();
        setMessage(result.message);
        setState(result.ok ? "success" : "error");
        if (result.ok) onSuccess?.();
      } catch {
        setMessage("We could not record this approval. Please try again.");
        setState("error");
      }
    }, duration);
  }

  useEffect(() => cancel, []);

  const disabled = state === "submitting" || state === "success";
  const label = state === "holding"
    ? holdingLabel
    : state === "submitting"
      ? "Recording approval…"
      : state === "success"
        ? "Approved"
        : idleLabel;

  return (
    <div>
      <button
        type="button"
        className="hold-confirm w-full px-5 py-5 text-left text-sm"
        style={{ "--hold-duration": `${duration}ms` } as CSSProperties}
        data-state={state}
        disabled={disabled}
        onPointerDown={begin}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault();
            begin();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") cancel();
        }}
      >
        <span className="relative z-10">{label}</span>
      </button>
      <p className={`mt-3 min-h-5 text-sm ${state === "error" ? "text-danger" : "text-muted"}`} aria-live="polite">
        {message}
      </p>
    </div>
  );
}
