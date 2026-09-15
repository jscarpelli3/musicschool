import Link from "next/link";
import { SetupNav, type SetupTab } from "./setup-nav";

export function SetupHeader({ schoolId, schoolName, active }: { schoolId: string; schoolName: string; active: SetupTab }) {
  return (
    <header className="overflow-hidden rounded-[var(--ui-radius-card)] bg-ink text-surface shadow-[var(--ui-shadow-soft)]">
      <div className="grid gap-8 px-6 py-7 sm:px-8 md:grid-cols-[1fr_2fr] md:items-end md:py-9">
        <Link href={`/schools/${schoolId}`} className="w-fit text-sm text-surface/70 transition-colors hover:text-surface">← Back to dashboard</Link>
        <div>
          <p className="text-sm text-surface/65">Settings for {schoolName}</p>
          <h1 className="mt-2 font-display text-4xl font-normal tracking-[-0.04em] sm:text-5xl">School setup</h1>
        </div>
      </div>
      <SetupNav schoolId={schoolId} active={active} />
    </header>
  );
}
