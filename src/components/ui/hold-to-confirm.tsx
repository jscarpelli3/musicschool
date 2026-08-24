"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import "./hold-to-confirm.css";

type HoldToConfirmProps = {
  action: () => Promise<{ ok: boolean; message: string }>;
  idleLabel: string;
  holdingLabel?: string;
  submittingLabel?: string;
  successLabel?: string;
  duration?: number;
  disabled?: boolean;
  disabledMessage?: string;
  failureMessage?: string;
  onSuccess?: () => void;
  refreshOnSuccess?: boolean;
};

export function HoldToConfirm({
  action,
  idleLabel,
  holdingLabel = "Keep holding…",
  submittingLabel = "Recording…",
  successLabel = "Recorded",
  duration = 1400,
  disabled = false,
  disabledMessage = "Complete the required information first.",
  failureMessage = "We could not complete this action. Please try again.",
  onSuccess,
  refreshOnSuccess = false,
}: HoldToConfirmProps) {
  const router = useRouter();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<"idle" | "holding" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  function cancel() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setState((current) => (current === "holding" ? "idle" : current));
  }

  function begin() {
    if (disabled) return;
    if ((state !== "idle" && state !== "error") || holdTimer.current) return;
    setMessage("");
    setState("holding");
    holdTimer.current = setTimeout(async () => {
      holdTimer.current = null;
      setState("submitting");
      try {
        const result = await action();
        setMessage(result.message);
        setState(result.ok ? "success" : "error");
        if (result.ok) {
          onSuccess?.();
          if (refreshOnSuccess) router.refresh();
        }
      } catch {
        setMessage(failureMessage);
        setState("error");
      }
    }, duration);
  }

  function beginPointer(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    begin();
  }

  function endPointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    cancel();
  }

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const buttonDisabled = disabled || state === "submitting" || state === "success";
  const label = state === "holding"
    ? holdingLabel
    : state === "submitting"
      ? submittingLabel
      : state === "success"
        ? successLabel
        : idleLabel;

  return (
    <div>
      <button
        type="button"
        className="hold-confirm w-full px-5 py-5 text-left text-sm"
        style={{ "--hold-duration": `${duration}ms` } as CSSProperties}
        data-state={state}
        disabled={buttonDisabled}
        onPointerDown={beginPointer}
        onPointerUp={endPointer}
        onPointerCancel={cancel}
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
        {disabled ? disabledMessage : state === "holding" ? "Keep holding until the line reaches the end." : message}
      </p>
    </div>
  );
}
