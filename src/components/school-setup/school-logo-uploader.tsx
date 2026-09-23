"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadSchoolLogo } from "@/app/schools/[schoolId]/media-actions";
import {
  isAcceptedImageType,
  SCHOOL_LOGO_UPLOAD_MAX_BYTES,
  SCHOOL_LOGO_UPLOAD_MAX_MB,
} from "@/lib/media/image-upload";

export function SchoolLogoUploader({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0] ?? null;
    setResult(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!isAcceptedImageType(selected.type) || selected.size <= 0 || selected.size > SCHOOL_LOGO_UPLOAD_MAX_BYTES) {
      event.currentTarget.value = "";
      setFile(null);
      setResult({ ok: false, message: `Choose a JPG, PNG, or WebP image no larger than ${SCHOOL_LOGO_UPLOAD_MAX_MB} MB.` });
      return;
    }
    setFile(selected);
  }

  async function upload() {
    if (!file || pending) return;
    setPending(true);
    setResult(null);
    const formData = new FormData();
    formData.set("logo", file);
    try {
      const nextResult = await uploadSchoolLogo(schoolId, formData);
      setResult(nextResult);
      if (nextResult.ok) {
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    } catch {
      setResult({ ok: false, message: "The school logo could not be uploaded. Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-ink" htmlFor={`school-logo-${schoolId}`}>Choose logo image</label>
      <input
        ref={inputRef}
        id={`school-logo-${schoolId}`}
        name="logo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={pending}
        onChange={chooseFile}
        className="mt-2 block w-full cursor-pointer rounded-control border border-dashed border-brand bg-canvas p-2 text-sm text-muted transition file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-canvas hover:bg-surface-raised disabled:cursor-wait disabled:opacity-60"
      />
      <p className="mt-2 text-xs text-muted">JPG, PNG, or WebP · {SCHOOL_LOGO_UPLOAD_MAX_MB} MB maximum</p>
      <button
        type="button"
        disabled={!file || pending}
        onClick={() => void upload()}
        className="mt-4 rounded-control bg-ink px-5 py-3 text-sm font-medium text-canvas transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Uploading…" : "Upload logo"}
      </button>
      {result ? <p role="status" aria-live="polite" className={`mt-3 text-sm ${result.ok ? "text-brand" : "text-danger"}`}>{result.message}</p> : null}
    </div>
  );
}
