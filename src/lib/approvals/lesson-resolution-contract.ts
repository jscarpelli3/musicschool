import "server-only";

export type LessonResolutionValue = "count_as_serviced" | "retain_for_reschedule" | "waive";
export type LessonResolutionChoice = { value: LessonResolutionValue; title: string; description: string };

const choice: Record<LessonResolutionValue, LessonResolutionChoice> = {
  retain_for_reschedule: { value: "retain_for_reschedule", title: "Keep a lesson to schedule later", description: "Remove this calendar event and return one lesson to the student’s Lessons to Schedule pool." },
  count_as_serviced: { value: "count_as_serviced", title: "Keep the original charge; no replacement", description: "Record that the lesson did not happen, while leaving its original charge intact and creating no replacement lesson." },
  waive: { value: "waive", title: "Cancel without a replacement or charge", description: "Remove this calendar event, create no replacement lesson, and do not count this occurrence toward billing." },
};

const resolutionValues: Record<string, LessonResolutionValue[]> = {
  student_cancellation: ["retain_for_reschedule", "count_as_serviced", "waive"],
  student_reschedule: ["retain_for_reschedule", "count_as_serviced", "waive"],
  student_no_show: ["count_as_serviced", "waive"],
  teacher_cancellation: ["retain_for_reschedule", "waive"],
  school_cancellation: ["retain_for_reschedule", "waive"],
};

const adjustmentKinds: Record<string, Array<"fee" | "credit">> = {
  student_cancellation: ["fee", "credit"], student_reschedule: ["fee", "credit"],
  student_no_show: ["fee", "credit"], teacher_cancellation: ["credit"], school_cancellation: ["credit"],
};

export function lessonResolutionContract(scenario: string) {
  const values = resolutionValues[scenario];
  if (!values) throw new Error(`Unsupported lesson-change scenario: ${scenario}`);
  return { choices: values.map((value) => choice[value]), adjustmentKinds: adjustmentKinds[scenario] ?? [] };
}
