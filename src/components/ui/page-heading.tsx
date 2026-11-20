import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import { MdApproval, MdDashboard, MdFamilyRestroom, MdGroups, MdNotificationsNone, MdReceiptLong, MdSchool, MdSettings } from "react-icons/md";

export type PageHeadingKind = "dashboard" | "students" | "families" | "staff" | "billing" | "approvals" | "notifications" | "settings";

const icons: Record<PageHeadingKind, IconType> = {
  dashboard: MdDashboard,
  students: MdSchool,
  families: MdFamilyRestroom,
  staff: MdGroups,
  billing: MdReceiptLong,
  approvals: MdApproval,
  notifications: MdNotificationsNone,
  settings: MdSettings,
};

export function PageHeading({ kind, title, description, meta, id, mobileAction }: {
  kind: PageHeadingKind;
  title: string;
  description?: string;
  meta?: string;
  id?: string;
  mobileAction?: ReactNode;
}) {
  const Icon = icons[kind];
  return <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-3 text-left sm:flex sm:gap-5">
    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--school-section-tab)] text-2xl text-ink sm:-mt-2 sm:h-16 sm:w-16 sm:text-4xl"><Icon /></span>
    {mobileAction ? <div className="flex h-11 items-center justify-end sm:hidden">{mobileAction}</div> : null}
    <div className="col-span-2 min-w-0 sm:col-span-1">
      <h1 id={id} className="font-display text-4xl font-normal tracking-[-0.04em] sm:text-6xl">{title}</h1>
      {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:mt-4">{description}</p> : null}
      {meta ? <p className="mt-2 text-sm text-muted">{meta}</p> : null}
    </div>
  </div>;
}
