import type { IconType } from "react-icons";
import { MdCalendarMonth, MdEventAvailable, MdGroups, MdReceiptLong } from "react-icons/md";

type SectionKind = "calendar" | "scheduling" | "students" | "billing";

const sectionStyles: Record<SectionKind, { icon: IconType; badge: string }> = {
  calendar: {
    icon: MdCalendarMonth,
    badge: "bg-[color-mix(in_srgb,var(--ui-brand)_16%,var(--ui-surface-raised))] text-brand",
  },
  scheduling: {
    icon: MdEventAvailable,
    badge: "bg-[color-mix(in_srgb,var(--ui-brand)_22%,var(--ui-surface-raised))] text-brand-hover",
  },
  students: {
    icon: MdGroups,
    badge: "bg-[color-mix(in_srgb,var(--ui-ink)_10%,var(--ui-surface-raised))] text-ink",
  },
  billing: {
    icon: MdReceiptLong,
    badge: "bg-[color-mix(in_srgb,var(--ui-brand)_12%,var(--ui-canvas))] text-brand",
  },
};

export function SectionHeading({ kind, eyebrow, title, description, id, size = "large" }: {
  kind: SectionKind;
  eyebrow: string;
  title: string;
  description?: string;
  id?: string;
  size?: "medium" | "large";
}) {
  const { icon: Icon, badge } = sectionStyles[kind];

  return (
    <div className="flex items-start gap-4">
      <span aria-hidden="true" className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl ${badge}`}>
        <Icon />
      </span>
      <div className="min-w-0">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.17em] text-brand">{eyebrow}</p>
        <h2 id={id} className={`mt-1 font-display font-normal tracking-[-0.03em] text-ink ${size === "large" ? "text-4xl" : "text-3xl"}`}>{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
    </div>
  );
}
