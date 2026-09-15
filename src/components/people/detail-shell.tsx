import type { ReactNode } from "react";

export function DetailHeader({ eyebrow, title, meta }: {
  eyebrow: string;
  title: string;
  meta?: string;
}) {
  return (
    <header className="pb-4">
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
    <section className="ui-card mt-6 grid gap-8 p-6 md:grid-cols-[minmax(12rem,1fr)_2fr] md:gap-12 md:p-8">
      <div>
        <h2 className="font-display text-3xl">{title}</h2>
        {description ? <p className="mt-3 text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function EmptyDetail({ children }: { children: ReactNode }) {
  return <p className="rounded-control bg-surface px-4 py-3 text-sm leading-6 text-muted">{children}</p>;
}
