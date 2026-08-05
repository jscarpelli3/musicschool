"use server";

import { createClient } from "@/lib/supabase/server";
import type { Column, RosterViewSettings } from "@/components/students/student-roster-table";

const columns: Column[] = ["family", "student", "parent", "day", "time", "teacher", "place", "month"];
const modeCounts: Record<Column, number> = {
  family: 2,
  student: 4,
  parent: 4,
  day: 2,
  time: 1,
  teacher: 2,
  place: 2,
  month: 6,
};

export async function saveStudentRosterView(schoolId: string, settings: RosterViewSettings) {
  const validColumns = Array.isArray(settings.columns)
    && settings.columns.length === columns.length
    && columns.every((column) => settings.columns.includes(column));
  const validSort = columns.includes(settings.sort.column)
    && Number.isInteger(settings.sort.mode)
    && settings.sort.mode >= 0
    && settings.sort.mode < modeCounts[settings.sort.column];
  if (!validColumns || !validSort) return;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;
  if (!profileId) throw new Error("Authentication required.");

  const { error } = await supabase.from("user_view_preferences").upsert({
    school_id: schoolId,
    profile_id: profileId,
    view_key: "student_roster",
    settings,
  }, { onConflict: "school_id,profile_id,view_key" });
  if (error) throw new Error("View preferences could not be saved.");
}
