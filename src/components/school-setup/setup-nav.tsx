import Link from "next/link";
import type { IconType } from "react-icons";
import { MdCreditCard, MdPalette, MdPolicy, MdSchool, MdTune } from "react-icons/md";

const tabs = [
  { key: "info", label: "School info", path: "setup", icon: MdSchool },
  { key: "offerings", label: "Lessons & classes", path: "products", icon: MdTune },
  { key: "policies", label: "Policies & documents", path: "policies", icon: MdPolicy },
  { key: "payments", label: "Payments", path: "payments", icon: MdCreditCard },
  { key: "appearance", label: "Appearance", path: "appearance", icon: MdPalette },
] as const;

export type SetupTab = (typeof tabs)[number]["key"];

export function SetupNav({ schoolId, active }: { schoolId: string; active: SetupTab }) {
  return (
    <nav className="mt-9 overflow-x-auto border-y border-line py-2" aria-label="School setup sections">
      <div className="flex w-max min-w-full gap-1 lg:w-full lg:flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon as IconType;
          return (
          <Link
            key={tab.key}
            href={`/schools/${schoolId}/${tab.path}`}
            aria-current={active === tab.key ? "page" : undefined}
            className={`inline-flex shrink-0 items-center gap-2 rounded-control px-3.5 py-2.5 text-sm transition-colors ${
              active === tab.key ? "bg-[var(--school-section-tab)] text-ink" : "text-muted hover:bg-surface-raised hover:text-ink"
            }`}
          >
            <Icon aria-hidden="true" className="text-lg" />
            {tab.label}
          </Link>
          );
        })}
      </div>
    </nav>
  );
}
