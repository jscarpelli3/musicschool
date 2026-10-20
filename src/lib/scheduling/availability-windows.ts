export type DatedAvailabilityRule = {
  teacher_id: string;
  weekday: number;
  effective_from: string;
  effective_until: string | null;
};

export function teacherIdsWithAvailabilityOnDates(rules: DatedAvailabilityRule[], dateKeys: string[]) {
  const teacherIds = new Set<string>();

  for (const rule of rules) {
    const applies = dateKeys.some((dateKey) => {
      const weekday = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
      return weekday === rule.weekday
        && rule.effective_from <= dateKey
        && (!rule.effective_until || rule.effective_until >= dateKey);
    });
    if (applies) teacherIds.add(rule.teacher_id);
  }

  return teacherIds;
}
