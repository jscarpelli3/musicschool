export function schoolCalendarWindow(timeZone: string, monthCount = 3) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const rangeStart = new Date(Date.UTC(year, month - 1, 1, 12));
  const rangeEnd = new Date(Date.UTC(year, month - 1 + monthCount, 1, 12));
  return {
    rangeStart,
    rangeEnd,
    queryStart: new Date(rangeStart.getTime() - 86_400_000).toISOString(),
    queryEnd: new Date(rangeEnd.getTime() + 86_400_000).toISOString(),
  };
}
