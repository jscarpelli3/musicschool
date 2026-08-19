import { CalendarRange } from "./calendar-range";

export type LessonCalendarItem = {
  lessonId: string;
  studentName: string;
  teacherName: string;
  productName: string;
  placeName: string;
  startsAt: string;
  endsAt: string;
};

type LessonCalendarProps = {
  id: string;
  lessons: readonly LessonCalendarItem[];
  rangeStart: Date;
  rangeEnd: Date;
  timeZone: string;
};

export function LessonCalendar({ id, lessons, rangeStart, rangeEnd, timeZone }: LessonCalendarProps) {
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  return <CalendarRange
    id={id}
    items={lessons}
    rangeStart={rangeStart}
    rangeEnd={rangeEnd}
    timeZone={timeZone}
    getItemDate={(lesson) => new Date(lesson.startsAt)}
    getItemKey={(lesson) => lesson.lessonId}
    emptyMonthLabel="No lessons this month"
    renderItem={(lesson, { view }) => view === "agenda"
      ? <article className="border-l-2 border-brand pl-4">
          <p className="text-sm"><span className="text-brand">{time.format(new Date(lesson.startsAt))}</span> · {lesson.studentName}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{lesson.productName} with {lesson.teacherName}</p>
          <p className="text-xs leading-5 text-muted">{lesson.placeName} · until {time.format(new Date(lesson.endsAt))}</p>
        </article>
      : <article className="border-l-2 border-brand bg-surface px-2 py-2">
          <p className="text-xs text-brand">{time.format(new Date(lesson.startsAt))}</p>
          <p className="mt-1 truncate text-xs text-ink" title={lesson.studentName}>{lesson.studentName}</p>
          <p className="mt-1 truncate text-xs text-muted" title={`${lesson.productName} with ${lesson.teacherName}`}>{lesson.productName}</p>
        </article>}
  />;
}
