import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ServiceEntitlementItem = {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string | null;
  teacherName: string | null;
  productName: string;
  durationMinutes: number;
  sourceStartsAt: string;
  expiresAt: string | null;
};

export async function loadServiceEntitlements(
  supabase: SupabaseClient<Database>,
  schoolId: string,
  filter: { studentIds?: string[]; teacherId?: string } = {},
) {
  let query = supabase.from("lesson_service_entitlements")
    .select("id,student_id,assigned_teacher_id,duration_minutes,source_lesson_event_id,expires_at")
    .eq("school_id", schoolId).eq("status", "waiting_to_schedule").order("created_at");
  if (filter.studentIds) {
    if (!filter.studentIds.length) return [];
    query = query.in("student_id", filter.studentIds);
  }
  if (filter.teacherId) query = query.eq("assigned_teacher_id", filter.teacherId);
  const { data: rows, error } = await query;
  if (error) throw new Error("Lessons to schedule could not be loaded.");
  if (!rows?.length) return [];
  const [peopleResult, eventsResult] = await Promise.all([
    supabase.from("people").select("id,first_name,last_name,preferred_name").eq("school_id", schoolId)
      .in("id", [...new Set(rows.flatMap((row) => [row.student_id, row.assigned_teacher_id].filter((id): id is string => Boolean(id))))]),
    supabase.from("lesson_events").select("id,product_id,starts_at").eq("school_id", schoolId).in("id", rows.map((row) => row.source_lesson_event_id)),
  ]);
  if (peopleResult.error || eventsResult.error) throw new Error("Lessons to schedule could not be resolved.");
  const productIds = [...new Set((eventsResult.data ?? []).map((event) => event.product_id))];
  const { data: products, error: productError } = await supabase.from("service_products").select("id,name").eq("school_id", schoolId).in("id", productIds);
  if (productError) throw new Error("Lesson offering names could not be loaded.");
  const people = new Map((peopleResult.data ?? []).map((person) => [person.id, `${person.preferred_name || person.first_name} ${person.last_name}`]));
  const events = new Map((eventsResult.data ?? []).map((event) => [event.id, event]));
  const productNames = new Map((products ?? []).map((product) => [product.id, product.name]));
  return rows.flatMap<ServiceEntitlementItem>((row) => {
    const event = events.get(row.source_lesson_event_id);
    if (!event) return [];
    return [{ id: row.id, studentId: row.student_id, studentName: people.get(row.student_id) ?? "Student",
      teacherId: row.assigned_teacher_id, teacherName: row.assigned_teacher_id ? people.get(row.assigned_teacher_id) ?? "Teacher" : null,
      productName: productNames.get(event.product_id) ?? "Lesson", durationMinutes: row.duration_minutes,
      sourceStartsAt: event.starts_at, expiresAt: row.expires_at }];
  });
}

