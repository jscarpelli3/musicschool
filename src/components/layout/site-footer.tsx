import Link from "next/link";

export function SiteFooter() {
  return <footer className="bg-ink text-canvas">
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <p className="font-display text-2xl">Common Time</p>
        <p className="mt-3 max-w-xl text-sm leading-6 text-canvas/65">Scheduling, billing, and communication tools for independent music schools. Schools remain responsible for their schedules, policies, statements, and charges.</p>
      </div>
      <nav aria-label="Legal and support" className="flex flex-wrap gap-x-5 gap-y-3 text-sm text-canvas/70">
        <Link href="/support" className="transition hover:text-canvas focus-visible:text-canvas">Help</Link>
        <Link href="/privacy" className="transition hover:text-canvas focus-visible:text-canvas">Privacy</Link>
        <Link href="/terms" className="transition hover:text-canvas focus-visible:text-canvas">SMS terms</Link>
        <Link href="/portal" className="transition hover:text-canvas focus-visible:text-canvas">Family portal</Link>
      </nav>
      <p className="text-xs text-canvas/45 md:col-span-2">© 2026 Common Time. All rights reserved.</p>
    </div>
  </footer>;
}
