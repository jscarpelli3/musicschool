"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { uploadAvatar } from "./actions";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 2 * 1024 * 1024;

export function AvatarUploader({ currentUrl, initial }: { currentUrl: string | null; initial: string }) {
  const router = useRouter();
  const previewUrl = useRef<string | null>(null);
  const confirmedUrl = useRef(currentUrl);
  const [displayUrl, setDisplayUrl] = useState(currentUrl);
  const [state, setState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState("Choose a new image and it will upload automatically.");

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > maxBytes) {
      setState("error");
      setMessage("Choose a JPG, PNG, or WebP image no larger than 2 MB.");
      return;
    }

    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const localUrl = URL.createObjectURL(file);
    previewUrl.current = localUrl;
    setDisplayUrl(localUrl);
    setState("uploading");
    setMessage("Checking and uploading your image…");

    let discardPreview = false;
    try {
      const decoder = new Image();
      decoder.src = localUrl;
      await decoder.decode();
      const formData = new FormData();
      formData.set("avatar", file);
      const result = await uploadAvatar(formData);
      if (!result.ok) {
        discardPreview = true;
        setDisplayUrl(confirmedUrl.current);
        setState("error");
        setMessage(result.message);
        return;
      }
      if (result.avatarUrl) {
        confirmedUrl.current = result.avatarUrl;
        setDisplayUrl(result.avatarUrl);
      }
      if (result.avatarUrl) discardPreview = true;
      setState("success");
      setMessage(result.message);
      router.refresh();
    } catch {
      discardPreview = true;
      setDisplayUrl(confirmedUrl.current);
      setState("error");
      setMessage("That image could not be read or uploaded. Your existing avatar was not changed.");
    } finally {
      if (previewUrl.current === localUrl && discardPreview) {
        URL.revokeObjectURL(localUrl);
        previewUrl.current = null;
      }
    }
  }

  return (
    <div className="flex flex-col gap-7 sm:flex-row sm:items-center">
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt="Your avatar" className={`h-28 w-28 rounded-full border object-cover transition ${state === "uploading" ? "animate-pulse border-brand opacity-70" : "border-line"}`} />
      ) : <div className="grid h-28 w-28 place-items-center rounded-full border border-line font-display text-4xl text-brand">{initial}</div>}
      <div className="max-w-sm">
        <label className={`inline-flex rounded-control border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-brand ${state === "uploading" ? "pointer-events-none opacity-60" : "cursor-pointer"}`}>
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={state === "uploading"} onChange={(event) => void chooseAvatar(event)} />
          {state === "uploading" ? "Uploading…" : displayUrl ? "Choose a new avatar" : "Choose an avatar"}
        </label>
        <p role="status" aria-live="polite" className={`mt-3 min-h-10 text-sm leading-5 ${state === "error" ? "text-danger" : state === "success" ? "text-brand" : "text-muted"}`}>{message}</p>
        <p className="mt-1 text-xs text-muted">JPG, PNG, or WebP · 2 MB maximum</p>
      </div>
    </div>
  );
}
