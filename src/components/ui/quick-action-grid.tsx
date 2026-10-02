import Link from "next/link";
import { MdArrowOutward, MdCalendarMonth, MdPersonOutline, MdReceiptLong, MdSchool } from "react-icons/md";

type QuickActionKind = "lesson" | "billing" | "student" | "teacher";

const icons = {
  lesson: MdCalendarMonth,
  billing: MdReceiptLong,
  student: MdPersonOutline,
  teacher: MdSchool,
} satisfies Record<QuickActionKind, typeof MdCalendarMonth>;

const accents: Record<QuickActionKind, string> = {
  lesson: "bg-brand text-canvas",
  billing: "bg-[color-mix(in_srgb,var(--ui-brand)_20%,var(--ui-surface-raised))] text-brand-hover",
  student: "bg-[color-mix(in_srgb,var(--ui-ink)_10%,var(--ui-surface-raised))] text-ink",
  teacher: "bg-[color-mix(in_srgb,var(--ui-brand)_12%,var(--ui-canvas))] text-brand",
};

export type QuickAction = {
  href: string;
  kind: QuickActionKind;
  title: string;
  detail: string;
};

export function QuickActionGrid({ actions, title = "Where to next?", description = "Skip the scenic route." }: {
  actions: QuickAction[];
  title?: string;
  description?: string;
}) {
  return <section className="py-8">
    <div className="flex items-end justify-between gap-4">
      <div><p className="text-xs uppercase tracking-[0.16em] text-brand">Quick hop</p><h3 className="mt-2 font-display text-2xl font-normal">{title}</h3></div>
      <p className="max-w-28 text-right text-xs leading-5 text-muted">{description}</p>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {actions.map((action) => {
        const Icon = icons[action.kind];
        return <Link key={`${action.kind}-${action.href}`} href={action.href} className="group relative min-h-36 overflow-hidden rounded-card border border-line bg-surface p-4 transition duration-200 hover:-translate-y-1 hover:border-brand hover:bg-surface-raised hover:shadow-[var(--ui-shadow-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <span className={`grid h-10 w-10 place-items-center rounded-full text-xl transition duration-200 group-hover:-rotate-6 group-hover:scale-110 ${accents[action.kind]}`}><Icon aria-hidden="true" /></span>
          <span className="mt-5 block pr-7 text-sm font-medium text-ink">{action.title}</span>
          <span className="mt-1 block text-xs leading-5 text-muted">{action.detail}</span>
          <MdArrowOutward aria-hidden="true" className="absolute right-4 top-4 text-lg text-muted transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
        </Link>;
      })}
    </div>
  </section>;
}
