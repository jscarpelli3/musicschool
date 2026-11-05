export type TeachingMode = "solo" | "team";

export function teachingModeFor<T>(teachers: readonly T[]): TeachingMode {
  return teachers.length === 1 ? "solo" : "team";
}

export function soleTeacherId<T extends { id: string }>(teachers: readonly T[]) {
  return teachingModeFor(teachers) === "solo" ? teachers[0].id : undefined;
}
