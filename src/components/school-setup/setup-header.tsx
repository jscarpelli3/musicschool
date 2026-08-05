import Link from "next/link";
import { SetupNav, type SetupTab } from "./setup-nav";

export function SetupHeader({ schoolId, schoolName, active }: { schoolId: string; schoolName: string; active: SetupTab }) {
  return (
    <header>
      <div className="grid gap-6 border-b border-line pb-8 md:grid-cols-[1fr_2fr] md:items-end">
        <Link href={`/schools/${schoolId}`} className="text-sm text-muted hover:text-ink">← Dashboard</Link>
        <div>
          <p className="text-sm text-muted">{schoolName}</p>
          <h1 className="mt-3 font-display text-5xl font-normal tracking-[-0.04em] sm:text-6xl">School setup.</h1>
        </div>
      </div>
      <SetupNav schoolId={schoolId} active={active} />
    </header>
  );
}
