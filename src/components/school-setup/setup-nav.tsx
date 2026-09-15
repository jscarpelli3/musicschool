import Link from "next/link";

const tabs = [
  { key: "info", label: "School info", path: "setup" },
  { key: "appearance", label: "Appearance", path: "appearance" },
  { key: "offerings", label: "Lessons & classes", path: "products" },
  { key: "spaces", label: "Lesson spaces", path: "places" },
  { key: "policies", label: "Policies & documents", path: "policies" },
  { key: "payments", label: "Payments", path: "payments" },
] as const;

export type SetupTab = (typeof tabs)[number]["key"];

export function SetupNav({ schoolId, active }: { schoolId: string; active: SetupTab }) {
  return (
    <nav className="overflow-x-auto bg-surface/10 px-3 py-3 sm:px-5" aria-label="School setup sections">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={`/schools/${schoolId}/${tab.path}`}
            aria-current={active === tab.key ? "page" : undefined}
            className={`rounded-md px-4 py-2.5 text-sm transition-colors ${
              active === tab.key ? "bg-surface text-ink shadow-sm" : "text-surface/70 hover:bg-surface/10 hover:text-surface"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
