import { LessonChangeReport } from "@/components/lessons/lesson-change-report";

type Result = { ok: boolean; message: string };

export function TeacherCancellationReport({ action }: { action: (reason: string) => Promise<Result> }) {
  return <LessonChangeReport action={action} buttonLabel="I can’t provide this lesson" title="Report a teacher cancellation" description="This sends the lesson to the owner for a scenario-specific remedy decision. It does not pretend the student cancelled or choose a financial result for the owner." />;
}
