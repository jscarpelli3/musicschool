import { OwnerPlanner } from "@/components/planner/owner-planner";
import type { TeacherCalendarData } from "@/lib/scheduling/teacher-calendar";
import type { LessonCreationOptions } from "./lesson-creation-dialog";

export function TeacherScheduleCalendar({
  schoolId,
  initialDate,
  timezone,
  teacher,
  schedule,
  contextLabel,
  canReschedule = false,
  currentTimeMs,
  lessonCreationOptions,
  rescheduleMode,
  rescheduleAction,
}: {
  schoolId: string;
  initialDate: string;
  timezone: string;
  teacher: { id: string; name: string; isOwner: boolean };
  schedule: TeacherCalendarData;
  contextLabel: string;
  canReschedule?: boolean;
  currentTimeMs: number;
  lessonCreationOptions?: LessonCreationOptions;
  rescheduleMode?: "apply" | "propose";
  rescheduleAction?: (input: { lessonId: string; localStart: string; reason: string }) => Promise<{ ok: boolean; message: string }>;
}) {
  return <OwnerPlanner
    schoolId={schoolId}
    canReschedule={canReschedule}
    initialDate={initialDate}
    timezone={timezone}
    teachers={[teacher]}
    studentNames={schedule.studentNames}
    studentDetails={Object.fromEntries(Object.entries(schedule.studentNames).map(([id, name]) => [id, { name, email: null, phone: null, contacts: [], payers: [] }]))}
    productNames={schedule.productNames}
    placeDetails={schedule.placeDetails}
    availability={schedule.availability}
    lessons={schedule.lessons.map((lesson) => ({
      ...lesson,
      teacher_id: teacher.id,
      billing_service_date: lesson.starts_at.slice(0, 10),
      can_reschedule: canReschedule && lesson.reschedule_allowed && lesson.status === "scheduled" && new Date(lesson.starts_at).getTime() > currentTimeMs,
      can_mark_reschedule: false,
    }))}
    contextLabel={contextLabel}
    showTeacherFilter={false}
    showAvailabilityLabels={false}
    lessonCreationOptions={lessonCreationOptions}
    rescheduleMode={rescheduleMode}
    rescheduleAction={rescheduleAction}
  />;
}
