import type { ReactNode } from "react";
import { PageHeading, type PageHeadingKind } from "@/components/ui/page-heading";

export function DetailHeader({ eyebrow, title, meta, kind, children }: {
  eyebrow: string;
  title: string;
  meta?: string;
  kind: Extract<PageHeadingKind, "students" | "families">;
  children?: ReactNode;
}) {
  return (
    <header className="pb-4">
      <p className="mb-3 ml-[4.75rem] text-xs text-brand sm:ml-[5.25rem]">{eyebrow}</p>
      <PageHeading kind={kind} title={title} meta={meta} />
      {children ? <div className="mt-4 flex flex-wrap gap-2 sm:ml-[5.25rem]">{children}</div> : null}
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
