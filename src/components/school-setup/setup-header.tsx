import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { SetupNav, type SetupTab } from "./setup-nav";

export function SetupHeader({ schoolId, schoolName, active }: { schoolId: string; schoolName: string; active: SetupTab }) {
  return (
    <header>
      <Link href={`/schools/${schoolId}`} className="mb-7 inline-flex text-sm text-muted transition-colors hover:text-ink">← Back to dashboard</Link>
      <PageHeading kind="settings" title="School setup" description={`Manage the details, teaching setup, policies, payments, and look of ${schoolName}.`} />
      <SetupNav schoolId={schoolId} active={active} />
    </header>
  );
}
