"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadSchoolLogo } from "@/app/schools/[schoolId]/media-actions";
import { ImageUploadControls } from "@/components/media/image-upload-controls";
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
      <ImageUploadControls
        id={`school-logo-${schoolId}`}
        inputName="logo"
        chooserLabel="Choose logo image"
        uploadLabel="Upload logo"
        maxSizeMb={SCHOOL_LOGO_UPLOAD_MAX_MB}
        inputRef={inputRef}
        hasFile={Boolean(file)}
        pending={pending}
        result={result}
        onChange={chooseFile}
        onUpload={() => void upload()}
      />
    </div>
  );
}
