import type { Metadata } from "next";
import { CommonTimeLogo } from "@/components/brand/common-time-logo";
import { ParallaxPhoto } from "@/components/marketing/parallax-photo";
import { EarlyAccessForm } from "./early-access-form";

export const metadata: Metadata = {
  title: "Common Time · Music school operations, in tune",
  description: "Common Time brings scheduling, billing, and family communication together for independent music schools.",
  alternates: { canonical: "https://www.commontime.studio" },
  robots: { index: true, follow: true },
};

export default function ComingSoonPage() {
  return (
    <main className="coming-soon relative mx-auto flex min-h-screen w-full max-w-[90rem] flex-col overflow-hidden px-5 py-6 sm:px-8 sm:py-8 lg:px-14 lg:py-10">
      <ParallaxPhoto src="/images/unsplash/andrey-k-piano-lesson.jpg" alt="" sizes="(min-width: 1440px) 90rem, 100vw" objectPosition="center 44%" tintClassName="bg-canvas/80 mix-blend-normal" />
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-ink/20 pb-5 text-xs tracking-[0.08em] text-muted sm:text-sm">
        <CommonTimeLogo priority light className="w-44" />
        <nav aria-label="Account access" className="flex items-center gap-5 sm:gap-7">
          <a className="transition hover:text-ink" href="https://app.commontime.studio/login">School sign in</a>
          <a className="text-brand transition hover:text-brand-hover" href="https://app.commontime.studio/portal">Family portal</a>
        </nav>
      </header>

      <section className="relative z-10 grid flex-1 content-start gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-16 lg:pt-20">
        <div>
          <p className="mb-6 text-sm text-brand">Coming soon</p>
          <h1 className="max-w-5xl font-display text-[clamp(4.5rem,13vw,12rem)] font-normal leading-[0.76] tracking-[-0.065em]">
            Keep the school in time.
          </h1>
        </div>

        <div className="lg:mb-3">
          <div className="rounded-card border border-white/40 bg-canvas/75 p-6 text-sm leading-6 text-muted shadow-xl shadow-ink/5 backdrop-blur-md">
            <p>Scheduling, billing, and family communication—built together for the particular rhythm of music lessons.</p>
            <p className="mt-8 text-ink">Common Time is currently in private development.</p>
            <EarlyAccessForm />
          </div>
        </div>
      </section>
      <p className="relative z-10 self-end text-[0.65rem] text-ink/60">Photo by <a className="underline underline-offset-2" href="https://unsplash.com/@anamnesis33?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Andrey K</a> on <a className="underline underline-offset-2" href="https://unsplash.com/photos/a-woman-and-a-little-girl-playing-a-piano-aOLDCqOEFDo?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a></p>
    </main>
  );
}
