import type { Metadata } from "next";
import Image from "next/image";
import { CommonTimeLogo } from "@/components/brand/common-time-logo";
import { EarlyAccessForm } from "./early-access-form";

export const metadata: Metadata = {
  title: "Common Time · Music school operations, in tune",
  description: "Common Time brings scheduling, billing, and family communication together for independent music schools.",
  alternates: { canonical: "https://www.commontime.studio" },
  robots: { index: true, follow: true },
};

export default function ComingSoonPage() {
  return (
    <main className="coming-soon mx-auto flex min-h-screen w-full max-w-[90rem] flex-col px-5 py-6 sm:px-8 sm:py-8 lg:px-14 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5 text-xs tracking-[0.08em] text-muted sm:text-sm">
        <CommonTimeLogo priority className="w-44" />
        <nav aria-label="Account access" className="flex items-center gap-5 sm:gap-7">
          <a className="transition hover:text-ink" href="https://app.commontime.studio/login">School sign in</a>
          <a className="text-brand transition hover:text-brand-hover" href="https://app.commontime.studio/portal">Family portal</a>
        </nav>
      </header>

      <section className="grid flex-1 content-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:gap-16">
        <div>
          <p className="mb-6 text-sm text-brand">Coming soon</p>
          <h1 className="max-w-5xl font-display text-[clamp(4.5rem,13vw,12rem)] font-normal leading-[0.76] tracking-[-0.065em]">
            Keep the school in time.
          </h1>
        </div>

        <div className="lg:mb-3">
          <figure className="group relative mb-7 aspect-[4/3] overflow-hidden rounded-card bg-surface">
            <Image
              src="/images/unsplash/andrey-k-piano-lesson.jpg"
              alt="A music teacher and young student playing piano together"
              fill
              sizes="(min-width: 1024px) 22rem, 100vw"
              className="object-cover transition duration-700 group-hover:scale-[1.02]"
            />
            <figcaption className="absolute bottom-2 right-2 rounded-full bg-ink/70 px-3 py-1 text-[0.65rem] text-white backdrop-blur-sm">
              Photo by <a className="underline decoration-white/40 underline-offset-2 hover:decoration-white" href="https://unsplash.com/@anamnesis33?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Andrey K</a> on <a className="underline decoration-white/40 underline-offset-2 hover:decoration-white" href="https://unsplash.com/photos/a-woman-and-a-little-girl-playing-a-piano-aOLDCqOEFDo?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Unsplash</a>
            </figcaption>
          </figure>
          <div className="border-t border-brand pt-5 text-sm leading-6 text-muted">
            <p>Scheduling, billing, and family communication—built together for the particular rhythm of music lessons.</p>
            <p className="mt-8 text-ink">Common Time is currently in private development.</p>
            <EarlyAccessForm />
          </div>
        </div>
      </section>
    </main>
  );
}
