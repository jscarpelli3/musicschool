import Link from "next/link";

const tabs = [
  { key: "info", label: "School info", path: "setup" },
  { key: "offerings", label: "Lessons & classes", path: "products" },
  { key: "spaces", label: "Lesson spaces", path: "places" },
  { key: "policies", label: "Policies & documents", path: "policies" },
  { key: "staff", label: "Staff", path: "staff" },
  { key: "payments", label: "Payments", path: "payments" },
] as const;

export type SetupTab = (typeof tabs)[number]["key"];

export function SetupNav({ schoolId, active }: { schoolId: string; active: SetupTab }) {
  return (
    <nav className="overflow-x-auto border-b border-line" aria-label="School setup sections">
      <div className="flex min-w-max">
        {tabs.map((tab, index) => (
          <Link
            key={tab.key}
            href={`/schools/${schoolId}/${tab.path}`}
            aria-current={active === tab.key ? "page" : undefined}
            className={`relative px-4 py-5 text-sm transition-colors first:pl-0 sm:px-6 ${
              active === tab.key ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            <span className="mr-2 text-[10px] text-brand">0{index + 1}</span>
            {tab.label}
            {active === tab.key ? <span className="absolute inset-x-4 bottom-0 h-px bg-brand first:left-0" /> : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
