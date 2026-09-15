import Link from "next/link";
import { CalendarRange } from "./calendar-range";

export type RecordLessonCalendarItem = {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  productName: string;
  placeName: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export function RecordLessonCalendar({ schoolId, id, lessons, rangeStart, rangeEnd, timeZone }: {
  schoolId: string;
  id: string;
  lessons: RecordLessonCalendarItem[];
  rangeStart: Date;
  rangeEnd: Date;
  timeZone: string;
}) {
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  return <CalendarRange
    id={id}
    items={lessons}
    rangeStart={rangeStart}
    rangeEnd={rangeEnd}
    timeZone={timeZone}
    getItemDate={(lesson) => new Date(lesson.startsAt)}
    getItemKey={(lesson) => lesson.id}
    emptyMonthLabel="No lessons this month"
    renderItem={(lesson, { view }) => view === "agenda" ? <article className="rounded-control bg-surface px-4 py-3">
      <p className="text-sm"><span className="text-brand">{time.format(new Date(lesson.startsAt))}</span> · <Link href={`/schools/${schoolId}/students/${lesson.studentId}`} className="hover:text-brand">{lesson.studentName}</Link></p>
      <p className="mt-1 text-xs leading-5 text-muted">{lesson.productName} with <Link href={`/schools/${schoolId}/staff/${lesson.teacherId}`} className="hover:text-brand">{lesson.teacherName}</Link></p>
      <p className="text-xs leading-5 text-muted">{lesson.placeName} · {lesson.status.replaceAll("_", " ")}</p>
    </article> : <article className="rounded-control bg-surface px-2 py-2">
      <p className="text-xs text-brand">{time.format(new Date(lesson.startsAt))}</p>
      <Link href={`/schools/${schoolId}/students/${lesson.studentId}`} className="mt-1 block truncate text-xs text-ink hover:text-brand" title={lesson.studentName}>{lesson.studentName}</Link>
      <Link href={`/schools/${schoolId}/staff/${lesson.teacherId}`} className="mt-1 block truncate text-xs text-muted hover:text-brand" title={lesson.teacherName}>{lesson.teacherName}</Link>
    </article>}
  />;
}
