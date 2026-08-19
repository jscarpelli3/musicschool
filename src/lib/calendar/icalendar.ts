export type CalendarLesson = {
  lessonId: string;
  studentName: string;
  teacherName: string;
  productName: string;
  placeName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  updatedAt: string;
};

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function utcDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldLine(line: string) {
  const chunks: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 73 && chunk) {
      chunks.push(chunk);
      chunk = ` ${character}`;
      bytes = size + 1;
    } else {
      chunk += character;
      bytes += size;
    }
  }
  chunks.push(chunk);
  return chunks.join("\r\n");
}

export function buildLessonCalendar(name: string, lessons: readonly CalendarLesson[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Common Time//Family Lessons//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const lesson of lessons) {
    const cancelled = lesson.status === "cancelled" || lesson.status === "rescheduled";
    const sequence = Math.max(0, Math.floor((new Date(lesson.updatedAt).getTime() - Date.UTC(2020, 0, 1)) / 1000));
    lines.push(
      "BEGIN:VEVENT",
      `UID:lesson-${lesson.lessonId}@calendar.commontime.studio`,
      `DTSTAMP:${utcDate(lesson.updatedAt)}`,
      `LAST-MODIFIED:${utcDate(lesson.updatedAt)}`,
      `SEQUENCE:${sequence}`,
      `DTSTART:${utcDate(lesson.startsAt)}`,
      `DTEND:${utcDate(lesson.endsAt)}`,
      `SUMMARY:${escapeText(`${lesson.studentName} — ${lesson.productName}`)}`,
      `DESCRIPTION:${escapeText(`${lesson.productName} with ${lesson.teacherName}`)}`,
      `LOCATION:${escapeText(lesson.placeName)}`,
      `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
