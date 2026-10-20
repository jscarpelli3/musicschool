"use client";

import type { ChangeEvent, RefObject } from "react";

type UploadResult = { ok: boolean; message: string };

export function ImageUploadControls({
  id,
  inputName,
  chooserLabel,
  uploadLabel,
  pendingLabel = "Uploading…",
  maxSizeMb,
  inputRef,
  hasFile,
  pending,
  result,
  onChange,
  onUpload,
  compact = false,
}: {
  id: string;
  inputName: string;
  chooserLabel: string;
  uploadLabel: string;
  pendingLabel?: string;
  maxSizeMb: number;
  inputRef: RefObject<HTMLInputElement | null>;
  hasFile: boolean;
  pending: boolean;
  result: UploadResult | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  compact?: boolean;
}) {
  return (
    <div>
      <label className={`block font-medium text-ink ${compact ? "text-xs" : "text-sm"}`} htmlFor={id}>{chooserLabel}</label>
      <input
        ref={inputRef}
        id={id}
        name={inputName}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={pending}
        onChange={onChange}
        className={`mt-2 block w-full cursor-pointer rounded-control border border-dashed border-brand bg-canvas text-muted transition file:cursor-pointer file:rounded-control file:border-0 file:bg-brand file:font-medium file:text-canvas hover:bg-surface-raised disabled:cursor-wait disabled:opacity-60 ${compact ? "p-1 text-xs file:mr-2 file:px-3 file:py-1.5 file:text-xs" : "p-2 text-sm file:mr-3 file:px-4 file:py-2 file:text-sm"}`}
      />
      {!compact ? <p className="mt-2 text-xs text-muted">JPG, PNG, or WebP · {maxSizeMb} MB maximum</p> : null}
      <button
        type="button"
        disabled={!hasFile || pending}
        onClick={onUpload}
        className={`rounded-control bg-ink font-medium text-canvas transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40 ${compact ? "mt-2 px-3 py-2 text-xs" : "mt-4 px-5 py-3 text-sm"}`}
      >
        {pending ? pendingLabel : uploadLabel}
      </button>
      {result ? <p role="status" aria-live="polite" className={`mt-3 text-sm ${result.ok ? "text-brand" : "text-danger"}`}>{result.message}</p> : null}
    </div>
  );
}
