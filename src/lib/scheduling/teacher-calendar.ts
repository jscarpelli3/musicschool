import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TeacherCalendarData = {
  availability: Array<{
    id: string;
    teacher_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    effective_from: string;
    effective_until: string | null;
  }>;
  lessons: Array<{
    id: string;
    student_id: string;
    product_id: string;
    place_id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    cancellation_timing: string | null;
    notes: string | null;
    outcome: string | null;
    staff_notes: string | null;
    reschedule_allowed: boolean;
    reschedule_blocked_reason: string | null;
    reschedule_reason_code: string | null;
    reschedule_reason_detail: string | null;
  }>;
  pendingProposals: Array<{
    id: string;
    teacher_id: string;
    student_id: string;
    proposed_starts_at: string;
    proposed_ends_at: string;
    status: "pending_teacher" | "pending_owner";
    proposal_kind: string;
    schedule_type: string;
    reason: string;
  }>;
  studentNames: Record<string, string>;
  productNames: Record<string, string>;
  placeDetails: Record<string, { name: string; details: string | null }>;
};

type PersonName = {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};

export function personDisplayName(person: PersonName) {
  return `${person.preferred_name || person.first_name} ${person.last_name}`;
}

export async function loadTeacherCalendar(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  teacherId: string,
  options: { rangeStart?: string; rangeEnd?: string } = {},
): Promise<TeacherCalendarData> {
  let lessonQuery = supabase
    .from("lesson_events")
    .select("id, student_id, product_id, place_id, starts_at, ends_at, status, cancellation_timing, notes, outcome, staff_notes, reschedule_allowed, reschedule_blocked_reason, reschedule_reason_code, reschedule_reason_detail")
    .eq("school_id", schoolId)
    .eq("teacher_id", teacherId);
  if (options.rangeStart) lessonQuery = lessonQuery.gte("starts_at", options.rangeStart);
  if (options.rangeEnd) lessonQuery = lessonQuery.lte("starts_at", options.rangeEnd);

  const [availabilityResult, lessonResult, proposalResult] = await Promise.all([
    supabase
      .from("teacher_availability_rules")
      .select("id, teacher_id, weekday, start_time, end_time, effective_from, effective_until")
      .eq("school_id", schoolId)
      .eq("teacher_id", teacherId)
      .order("weekday")
      .order("start_time"),
    lessonQuery.order("starts_at"),
    supabase.from("lesson_schedule_proposals")
      .select("id,teacher_id,student_id,proposed_starts_at,proposed_ends_at,status,proposal_kind,schedule_type,reason")
      .eq("school_id", schoolId).eq("teacher_id", teacherId).in("status", ["pending_teacher", "pending_owner"]),
  ]);
  if (availabilityResult.error) throw new Error("Teacher availability could not be loaded.");
  if (lessonResult.error) throw new Error("Teacher lessons could not be loaded.");
  if (proposalResult.error) throw new Error("Teacher scheduling proposals could not be loaded.");

  const lessons = (lessonResult.data ?? []).flatMap((lesson) => lesson.place_id ? [lesson] : []);
  const pendingProposals = (proposalResult.data ?? []).map((item) => ({ ...item, status: item.status === "pending_owner" ? "pending_owner" as const : "pending_teacher" as const }));
  const studentIds = [...new Set([...lessons.map((lesson) => lesson.student_id), ...pendingProposals.map((item) => item.student_id)])];
  const productIds = [...new Set(lessons.map((lesson) => lesson.product_id))];
  const placeIds = [...new Set(lessons.map((lesson) => lesson.place_id))];
  const [studentResult, productResult, placeResult] = await Promise.all([
    studentIds.length
      ? supabase.from("people").select("id, first_name, last_name, preferred_name").eq("school_id", schoolId).in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? supabase.from("service_products").select("id, name").eq("school_id", schoolId).in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    placeIds.length
      ? supabase.from("lesson_places").select("id, name, details").eq("school_id", schoolId).in("id", placeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (studentResult.error || productResult.error || placeResult.error) {
    throw new Error("Teacher calendar details could not be loaded.");
  }

  return {
    availability: availabilityResult.data ?? [],
    lessons,
    pendingProposals,
    studentNames: Object.fromEntries((studentResult.data ?? []).map((student) => [student.id, personDisplayName(student)])),
    productNames: Object.fromEntries((productResult.data ?? []).map((product) => [product.id, product.name])),
    placeDetails: Object.fromEntries((placeResult.data ?? []).map((place) => [place.id, { name: place.name, details: place.details }])),
  };
}
