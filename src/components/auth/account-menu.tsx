"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MdPersonOutline, MdSettings } from "react-icons/md";
import { AppSignOut } from "@/components/auth/app-sign-out";

export function AccountMenu({ avatarUrl, role }: { avatarUrl?: string | null; role: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div ref={containerRef} className="relative" onMouseEnter={() => setOpen(true)}>
      <p className="mb-1 text-right text-[10px] capitalize tracking-[0.12em] text-muted">{role}</p>
      <div className="flex items-center gap-1">
        <Link href="/profile#avatar" aria-label="Change avatar" className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-line bg-surface text-muted transition hover:border-brand hover:text-ink">
          {avatarUrl ? <img /* eslint-disable-line @next/next/no-img-element */ src={avatarUrl} alt="Your avatar" className="h-full w-full object-cover" /> : <MdPersonOutline aria-hidden="true" className="h-5 w-5" />}
        </Link>
        <button type="button" aria-label="Account settings" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <MdSettings aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      {open ? (
        <div className="ui-card absolute top-full right-0 z-[100] w-48 overflow-hidden p-2" onFocusCapture={() => setOpen(true)}>
          <Link href="/profile#avatar" onClick={() => setOpen(false)} className="block rounded-control px-3 py-2 text-sm text-ink transition hover:bg-brand/10">Avatar</Link>
          <Link href="/profile#profile-info" onClick={() => setOpen(false)} className="block rounded-control px-3 py-2 text-sm text-ink transition hover:bg-brand/10">Profile info</Link>
          <div className="mt-1 border-t border-line pt-1">
            <AppSignOut className="w-full rounded-control px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
