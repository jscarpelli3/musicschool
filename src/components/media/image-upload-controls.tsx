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
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink" htmlFor={id}>{chooserLabel}</label>
      <input
        ref={inputRef}
        id={id}
        name={inputName}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={pending}
        onChange={onChange}
        className="mt-2 block w-full cursor-pointer rounded-control border border-dashed border-brand bg-canvas p-2 text-sm text-muted transition file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-canvas hover:bg-surface-raised disabled:cursor-wait disabled:opacity-60"
      />
      <p className="mt-2 text-xs text-muted">JPG, PNG, or WebP · {maxSizeMb} MB maximum</p>
      <button
        type="button"
        disabled={!hasFile || pending}
        onClick={onUpload}
        className="mt-4 rounded-control bg-ink px-5 py-3 text-sm font-medium text-canvas transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? pendingLabel : uploadLabel}
      </button>
      {result ? <p role="status" aria-live="polite" className={`mt-3 text-sm ${result.ok ? "text-brand" : "text-danger"}`}>{result.message}</p> : null}
    </div>
  );
}
