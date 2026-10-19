import type { IconType } from "react-icons";
import { MdDashboard, MdFamilyRestroom, MdGroups, MdSchool } from "react-icons/md";

export type PageHeadingKind = "dashboard" | "students" | "families" | "staff";

const icons: Record<PageHeadingKind, IconType> = {
  dashboard: MdDashboard,
  students: MdSchool,
  families: MdFamilyRestroom,
  staff: MdGroups,
};

export function PageHeading({ kind, title, description, meta, id }: {
  kind: PageHeadingKind;
  title: string;
  description?: string;
  meta?: string;
  id?: string;
}) {
  const Icon = icons[kind];
  return <div className="flex items-start gap-5">
    <span aria-hidden="true" className="mt-1 grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[var(--school-section-tab)] text-3xl text-ink sm:h-16 sm:w-16 sm:text-4xl"><Icon /></span>
    <div className="min-w-0">
      <h1 id={id} className="font-display text-5xl font-normal tracking-[-0.04em] sm:text-6xl">{title}</h1>
      {description ? <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
      {meta ? <p className="mt-2 text-sm text-muted">{meta}</p> : null}
    </div>
  </div>;
}
