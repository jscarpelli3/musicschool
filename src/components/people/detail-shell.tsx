import type { ReactNode } from "react";

export function DetailHeader({ eyebrow, title, meta }: {
  eyebrow: string;
  title: string;
  meta?: string;
}) {
  return (
    <header className="border-b border-line pb-8">
      <div>
        <p className="text-xs text-brand">{eyebrow}</p>
        <h1 className="mt-3 font-display text-5xl font-normal tracking-[-0.04em] sm:text-6xl">{title}</h1>
        {meta ? <p className="mt-3 text-sm text-muted">{meta}</p> : null}
      </div>
    </header>
  );
}

export function DetailSection({ title, description, children }: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
      <div className="border-b border-line py-8 md:border-r md:border-b-0 md:py-10 md:pr-10">
        <h2 className="font-display text-3xl">{title}</h2>
        {description ? <p className="mt-3 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      <div className="py-8 md:py-10 md:pl-10">{children}</div>
    </section>
  );
}

export function EmptyDetail({ children }: { children: ReactNode }) {
  return <p className="border-l border-line pl-4 text-sm leading-6 text-muted">{children}</p>;
}
