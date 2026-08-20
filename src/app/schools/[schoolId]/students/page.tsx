import { SchoolWorkspace } from "../page";

export const dynamic = "force-dynamic";

export default async function StudentsPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params;
  return <SchoolWorkspace schoolId={schoolId} view="students" />;
}
