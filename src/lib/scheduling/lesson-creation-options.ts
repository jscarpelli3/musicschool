import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { LessonCreationOptions } from "@/components/scheduling/lesson-creation-dialog";
import { lessonPlaceLabel } from "@/lib/scheduling/lesson-place-label";

export async function loadLessonCreationOptions(client: SupabaseClient<Database>, schoolId: string, timeZone: string): Promise<LessonCreationOptions> {
  const now = new Date();
  const windowStart = new Date(now); windowStart.setUTCMonth(windowStart.getUTCMonth() - 1);
  const windowEnd = new Date(now); windowEnd.setUTCMonth(windowEnd.getUTCMonth() + 14);
  const [teachersResult, studentsResult, peopleResult, productsResult, placesResult, availabilityResult, lessonsResult, instrumentsResult, teacherInstrumentsResult] = await Promise.all([
    client.from("teachers").select("person_id,outside_availability_policy").eq("school_id", schoolId),
    client.from("students").select("person_id,primary_teacher_id").eq("school_id", schoolId),
    client.from("people").select("id,first_name,last_name,preferred_name").eq("school_id", schoolId),
    client.from("service_products").select("id,name,duration_minutes,price_cents,currency,status,format").eq("school_id", schoolId),
    client.from("lesson_places").select("id,name,status,kind").eq("school_id", schoolId),
    client.from("teacher_availability_rules").select("id,teacher_id,weekday,start_time,end_time,effective_from,effective_until").eq("school_id", schoolId),
    client.from("lesson_events").select("teacher_id,student_id,starts_at,ends_at,status").eq("school_id", schoolId).gte("starts_at", windowStart.toISOString()).lt("starts_at", windowEnd.toISOString()),
    client.from("school_instruments").select("id,name").eq("school_id", schoolId).eq("is_active", true).order("name"),
    client.from("teacher_instruments").select("teacher_id,instrument_id").eq("school_id", schoolId),
  ]);
  const failed = [teachersResult, studentsResult, peopleResult, productsResult, placesResult, availabilityResult, lessonsResult, instrumentsResult, teacherInstrumentsResult].find((result) => result.error);
  if (failed?.error) throw new Error(`Lesson finder could not load: ${failed.error.message}`);
  const people = new Map((peopleResult.data ?? []).map((person) => [person.id, person]));
  const displayName = (person: NonNullable<typeof peopleResult.data>[number]) => `${person.preferred_name || person.first_name} ${person.last_name}`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const minimumTimeToday = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return {
    students: (studentsResult.data ?? []).flatMap((student) => { const person = people.get(student.person_id); return person ? [{ id: person.id, label: displayName(person) }] : []; }),
    primaryTeacherByStudent: Object.fromEntries((studentsResult.data ?? []).flatMap((student) => student.primary_teacher_id ? [[student.person_id, student.primary_teacher_id]] : [])),
    teachers: (teachersResult.data ?? []).flatMap((teacher) => { const person = people.get(teacher.person_id); return person ? [{ id: person.id, label: displayName(person), outsideAvailabilityPolicy: teacher.outside_availability_policy === "require_approval" ? "require_approval" as const : "notify_only" as const }] : []; }),
    products: (productsResult.data ?? []).filter((product) => product.status === "active" && product.format === "private_lesson").map((product) => ({ id: product.id, label: product.name, durationMinutes: product.duration_minutes, priceLabel: new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(product.price_cents / 100) })),
    instruments: (instrumentsResult.data ?? []).map((instrument) => ({ id: instrument.id, label: instrument.name })),
    instrumentIdsByTeacher: (teacherInstrumentsResult.data ?? []).reduce<Record<string,string[]>>((groups, item) => { (groups[item.teacher_id] ??= []).push(item.instrument_id); return groups; }, {}),
    places: (placesResult.data ?? []).filter((place) => place.status === "active" && ["school", "student_home", "online"].includes(place.kind)).map((place) => ({ id: place.id, label: lessonPlaceLabel(place), kind: place.kind as "school" | "student_home" | "online" })),
    availability: availabilityResult.data ?? [],
    busyLessons: (lessonsResult.data ?? []).map((lesson) => ({ teacherId: lesson.teacher_id, studentId: lesson.student_id, startsAt: lesson.starts_at, endsAt: lesson.ends_at, status: lesson.status })),
    today,
    minimumTimeToday,
  };
}
