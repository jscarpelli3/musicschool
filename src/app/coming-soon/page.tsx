import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Common Time · Music school operations, in tune",
  description: "Common Time brings scheduling, billing, and family communication together for independent music schools.",
  alternates: { canonical: "https://www.commontime.studio" },
  robots: { index: true, follow: true },
};

export default function ComingSoonPage() {
  return (
    <main className="coming-soon mx-auto flex min-h-screen w-full max-w-[90rem] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-14 lg:py-10">
      <header className="flex items-center justify-between border-b border-line pb-5 text-xs tracking-[0.08em] text-muted sm:text-sm">
        <span className="text-ink">Common Time</span>
        <span>For independent music schools</span>
      </header>

      <section className="grid flex-1 content-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:gap-20">
        <div>
          <p className="mb-6 text-sm text-brand">Coming soon</p>
          <h1 className="max-w-5xl font-display text-[clamp(4.5rem,13vw,12rem)] font-normal leading-[0.76] tracking-[-0.065em]">
            Keep the school in time.
          </h1>
        </div>

        <div className="border-t border-brand pt-5 text-sm leading-6 text-muted lg:mb-3">
          <p>Scheduling, billing, and family communication—built together for the particular rhythm of music lessons.</p>
          <p className="mt-8 text-ink">Common Time is currently in private development.</p>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-xs text-muted">
        <span>commontime.studio</span>
        <span>Chicago · 2026</span>
      </footer>
    </main>
  );
}
