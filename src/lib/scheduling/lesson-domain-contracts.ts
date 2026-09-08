export const rescheduleReasonOptions = [
  { value: "family_request", label: "Family requested another time" },
  { value: "teacher_request", label: "Teacher requested another time" },
  { value: "school_closure", label: "School closure or holiday" },
  { value: "illness", label: "Illness" },
  { value: "schedule_conflict", label: "Schedule conflict" },
  { value: "other", label: "Other" },
] as const;

export type RescheduleReasonCode = typeof rescheduleReasonOptions[number]["value"];

const rescheduleReasonLabels = new Map<string, string>(
  rescheduleReasonOptions.map(({ value, label }) => [value, label]),
);

export function isRescheduleReasonCode(value: string): value is RescheduleReasonCode {
  return rescheduleReasonLabels.has(value);
}

export function rescheduleReasonLabel(code: string, detail: string | null) {
  if (!isRescheduleReasonCode(code)) throw new Error(`Unsupported reschedule reason: ${code}`);
  if (code === "other") return detail?.trim() || "Other";
  return rescheduleReasonLabels.get(code)!;
}

export const lessonRequestTypes = ["cancellation", "reschedule"] as const;
export type LessonRequestType = typeof lessonRequestTypes[number];

export const lessonRequestedResolutions = ["cancel", "reschedule", "lesson_credit"] as const;
export type LessonRequestedResolution = typeof lessonRequestedResolutions[number];

export function isLessonRequestType(value: string): value is LessonRequestType {
  return (lessonRequestTypes as readonly string[]).includes(value);
}

export function isLessonRequestedResolution(value: string): value is LessonRequestedResolution {
  return (lessonRequestedResolutions as readonly string[]).includes(value);
}

export const lessonEventDescriptors = {
  scheduled: { label: "Scheduled", occupiesCalendar: true },
  completed: { label: "Completed", occupiesCalendar: false },
  cancelled: { label: "Cancelled", occupiesCalendar: false },
  no_show: { label: "No show", occupiesCalendar: false },
  rescheduled: { label: "Rescheduled", occupiesCalendar: false },
} as const;

export type LessonEventStatus = keyof typeof lessonEventDescriptors;

export function lessonEventDescriptor(status: string) {
  if (!(status in lessonEventDescriptors)) throw new Error(`Unsupported lesson event status: ${status}`);
  return lessonEventDescriptors[status as LessonEventStatus];
}
