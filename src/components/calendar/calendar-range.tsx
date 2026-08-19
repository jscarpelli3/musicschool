import type { ReactNode } from "react";

type CalendarView = "agenda" | "grid";

type CalendarRenderContext = {
  dateKey: string;
  view: CalendarView;
};

type CalendarRangeProps<Item> = {
  id: string;
  items: readonly Item[];
  rangeStart: Date;
  rangeEnd: Date;
  timeZone: string;
  getItemDate: (item: Item) => Date;
  getItemKey: (item: Item) => string;
  renderItem: (item: Item, context: CalendarRenderContext) => ReactNode;
  emptyMonthLabel?: string;
};

type CalendarMonth<Item> = {
  key: string;
  label: string;
  year: number;
  month: number;
  days: Array<{ dateKey: string; day: number; items: Item[] }>;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function zonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonths<Item>({ items, rangeStart, rangeEnd, timeZone, getItemDate }: Pick<CalendarRangeProps<Item>, "items" | "rangeStart" | "rangeEnd" | "timeZone" | "getItemDate">) {
  const start = zonedDateParts(rangeStart, timeZone);
  const inclusiveEnd = new Date(Math.max(rangeStart.getTime(), rangeEnd.getTime() - 1));
  const end = zonedDateParts(inclusiveEnd, timeZone);
  const byDate = new Map<string, Item[]>();

  for (const item of items) {
    const itemDate = zonedDateParts(getItemDate(item), timeZone);
    const key = dateKey(itemDate.year, itemDate.month, itemDate.day);
    const dayItems = byDate.get(key);
    if (dayItems) dayItems.push(item);
    else byDate.set(key, [item]);
  }

  const months: CalendarMonth<Item>[] = [];
  let cursor = start.year * 12 + start.month - 1;
  const finalMonth = end.year * 12 + end.month - 1;
  while (cursor <= finalMonth) {
    const year = Math.floor(cursor / 12);
    const monthIndex = cursor % 12;
    const month = monthIndex + 1;
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    months.push({
      key: `${year}-${String(month).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, monthIndex, 1))),
      year,
      month,
      days: Array.from({ length: dayCount }, (_, index) => {
        const day = index + 1;
        const key = dateKey(year, month, day);
        return { dateKey: key, day, items: byDate.get(key) ?? [] };
      }),
    });
    cursor += 1;
  }
  return months;
}

export function CalendarRange<Item>({ id, items, rangeStart, rangeEnd, timeZone, getItemDate, getItemKey, renderItem, emptyMonthLabel = "No scheduled items" }: CalendarRangeProps<Item>) {
  const months = buildMonths({ items, rangeStart, rangeEnd, timeZone, getItemDate });
  return <div className="grid gap-section xl:grid-cols-2">
    {months.map((month) => {
      const firstWeekday = new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay();
      const activeDays = month.days.filter((day) => day.items.length);
      return <section key={month.key} aria-labelledby={`${id}-${month.key}`} className="min-w-0">
        <h2 id={`${id}-${month.key}`} className="border-b border-brand pb-3 font-display text-3xl">{month.label}</h2>

        <div className="sm:hidden">
          {activeDays.length ? <ol className="divide-y divide-line">
            {activeDays.map((day) => <li key={day.dateKey} className="grid grid-cols-[4.5rem_1fr] gap-4 py-4">
              <time dateTime={day.dateKey} className="text-sm text-muted">
                <span className="block text-xs">{WEEKDAYS[new Date(`${day.dateKey}T00:00:00Z`).getUTCDay()].slice(0, 3)}</span>
                <span className="mt-1 block font-display text-3xl text-ink">{day.day}</span>
              </time>
              <div className="space-y-3">{day.items.map((item) => <div key={getItemKey(item)}>{renderItem(item, { dateKey: day.dateKey, view: "agenda" })}</div>)}</div>
            </li>)}
          </ol> : <p className="border-b border-line py-6 text-sm text-muted">{emptyMonthLabel}</p>}
        </div>

        <div className="hidden sm:block">
          <div className="grid grid-cols-7 border-b border-line" aria-hidden="true">
            {WEEKDAYS.map((weekday) => <div key={weekday} className="px-2 py-2 text-xs text-muted">{weekday.slice(0, 3)}</div>)}
          </div>
          <div className="grid grid-cols-7 border-l border-line">
            {Array.from({ length: firstWeekday }, (_, index) => <div key={`blank-${index}`} aria-hidden="true" className="min-h-28 border-r border-b border-line bg-surface/20" />)}
            {month.days.map((day) => <div key={day.dateKey} className="min-h-28 min-w-0 border-r border-b border-line p-2">
              <time dateTime={day.dateKey} className="text-xs text-muted">{day.day}</time>
              <div className="mt-2 space-y-2">{day.items.map((item) => <div key={getItemKey(item)}>{renderItem(item, { dateKey: day.dateKey, view: "grid" })}</div>)}</div>
            </div>)}
          </div>
        </div>
      </section>;
    })}
  </div>;
}
