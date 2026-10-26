import Link from "next/link";
import { MdAutoStories } from "react-icons/md";
import { PageHeading } from "@/components/ui/page-heading";
import { SetupNav, type SetupTab } from "./setup-nav";

export function SetupHeader({ schoolId, schoolName, active }: { schoolId: string; schoolName: string; active: SetupTab }) {
  return (
    <header>
      <Link href={`/schools/${schoolId}`} className="mb-7 inline-flex text-sm text-muted transition-colors hover:text-ink">← Back to dashboard</Link>
      <div className="flex flex-wrap items-center justify-between gap-6">
        <PageHeading kind="settings" title="School setup" description={`Manage the details, teaching setup, policies, payments, and look of ${schoolName}.`} />
        <Link href={`/schools/${schoolId}/onboarding`} className="inline-flex shrink-0 items-center gap-2 rounded-control border border-brand/40 bg-brand/10 px-4 py-3 text-sm text-brand transition hover:border-brand hover:bg-brand/15">
          <MdAutoStories aria-hidden="true" className="text-xl" />
          <span>Setup guide</span>
        </Link>
      </div>
      <SetupNav schoolId={schoolId} active={active} />
    </header>
  );
}
