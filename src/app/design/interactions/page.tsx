import Link from "next/link";
import { InteractionStudy } from "./interaction-study";

export default function InteractionStudyPage() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="grid gap-8 border-b border-line px-6 py-8 md:grid-cols-[1fr_2fr] md:px-12">
        <div>
          <p className="text-sm text-brand">Common Time / interaction study 01</p>
          <Link href="/design" className="mt-5 inline-block text-xs text-muted hover:text-ink">← Typography study</Link>
        </div>
        <div>
          <h1 className="max-w-3xl font-display text-5xl font-normal leading-[0.96] tracking-[-0.04em] md:text-7xl">
            Lines that explain what’s happening.
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-6 text-muted">
            A restrained motion language for intent, focus, selection, relationships, progress, and consequential actions.
          </p>
        </div>
      </header>
      <InteractionStudy />
    </main>
  );
}
