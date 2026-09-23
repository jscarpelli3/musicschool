"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageUploadControls } from "@/components/media/image-upload-controls";
import { AVATAR_UPLOAD_MAX_BYTES, AVATAR_UPLOAD_MAX_MB, isAcceptedImageType } from "@/lib/media/image-upload";
import { uploadAvatar } from "./actions";

export function AvatarUploader({ currentUrl, initial }: { currentUrl: string | null; initial: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const confirmedUrl = useRef(currentUrl);
  const [displayUrl, setDisplayUrl] = useState(currentUrl);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  function clearSelection() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function discardPreview() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setDisplayUrl(confirmedUrl.current);
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const selected = input.files?.[0] ?? null;
    setResult(null);
    if (!selected) {
      clearSelection();
      discardPreview();
      return;
    }
    if (!isAcceptedImageType(selected.type) || selected.size <= 0 || selected.size > AVATAR_UPLOAD_MAX_BYTES) {
      clearSelection();
      discardPreview();
      setResult({ ok: false, message: `Choose a JPG, PNG, or WebP image no larger than ${AVATAR_UPLOAD_MAX_MB} MB.` });
      return;
    }

    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const localUrl = URL.createObjectURL(selected);
    previewUrl.current = localUrl;
    setDisplayUrl(localUrl);
    setFile(selected);
  }

  async function upload() {
    if (!file || pending) return;
    setPending(true);
    setResult(null);
    try {
      const decoder = new Image();
      decoder.src = displayUrl ?? "";
      await decoder.decode();
      const formData = new FormData();
      formData.set("avatar", file);
      const nextResult = await uploadAvatar(formData);
      setResult(nextResult);
      if (!nextResult.ok) {
        clearSelection();
        discardPreview();
        return;
      }
      if (nextResult.avatarUrl) {
        confirmedUrl.current = nextResult.avatarUrl;
        setDisplayUrl(nextResult.avatarUrl);
      }
      clearSelection();
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = null;
      router.refresh();
    } catch {
      clearSelection();
      discardPreview();
      setResult({ ok: false, message: "That image could not be read or uploaded. Your existing avatar was not changed." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-7 sm:flex-row sm:items-center">
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt="Your avatar" className={`h-28 w-28 rounded-full border object-cover transition ${pending ? "animate-pulse border-brand opacity-70" : "border-line"}`} />
      ) : <div className="grid h-28 w-28 place-items-center rounded-full border border-line font-display text-4xl text-brand">{initial}</div>}
      <div className="w-full max-w-sm">
        <ImageUploadControls
          id="avatar-image"
          inputName="avatar"
          chooserLabel={currentUrl ? "Choose a new avatar image" : "Choose avatar image"}
          uploadLabel="Upload avatar"
          maxSizeMb={AVATAR_UPLOAD_MAX_MB}
          inputRef={inputRef}
          hasFile={Boolean(file)}
          pending={pending}
          result={result}
          onChange={chooseAvatar}
          onUpload={() => void upload()}
        />
      </div>
    </div>
  );
}
