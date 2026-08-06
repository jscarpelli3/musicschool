"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DragHandle } from "@/components/ui/drag-handle";
import { HorizontalScrollFrame } from "@/components/ui/horizontal-scroll-frame";

export type LessonOutcome = "completed" | "rescheduled" | "cancelled_timely" | "cancelled_late" | "no_show" | "upcoming" | "unrecorded";

export type StudentRosterRow = {
  id: string;
  billingAccountId: string | null;
  schoolId: string;
  family: string;
  student: string;
  studentFirst: string;
  studentLast: string;
  parent: string;
  payerName: string;
  payerRelationship: string;
  day: string;
  dayOrder: number;
  time: string;
  timeMinutes: number;
  teacher: string;
  place: string;
  lessons: Array<{ id: string; outcome: LessonOutcome }>;
};

const definitions = {
  family: { label: "Family", width: "min-w-40" },
  student: { label: "Student", width: "min-w-40" },
  parent: { label: "Parent / payer", width: "min-w-44" },
  day: { label: "Day", width: "min-w-32" },
  time: { label: "Time", width: "min-w-40" },
  teacher: { label: "Teacher", width: "min-w-44" },
  place: { label: "Space", width: "min-w-40" },
  month: { label: "This month", width: "min-w-72" },
} as const;
export type Column = keyof typeof definitions;
export type RosterViewSettings = { columns: Column[]; sort: { column: Column; mode: number } };
const defaults: Column[] = ["family", "student", "parent", "day", "time", "teacher", "place", "month"];

const sortModes = {
  family: ["Family A–Z", "Family Z–A"],
  student: ["First name A–Z", "First name Z–A", "Last name A–Z", "Last name Z–A"],
  parent: ["Payer A–Z", "Payer Z–A", "Relationship A–Z", "Relationship Z–A"],
  day: ["Monday–Sunday", "Sunday–Monday"],
  time: ["Earliest first"],
  teacher: ["Teacher A–Z", "Teacher Z–A"],
  place: ["Space A–Z", "Space Z–A"],
  month: ["Most serviced", "Most no-shows", "Most rescheduled", "Most timely cancellations", "Most late cancellations", "Most lessons"],
} satisfies Record<Column, string[]>;

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function outcomeCount(row: StudentRosterRow, outcome: LessonOutcome) {
  return row.lessons.filter((lesson) => lesson.outcome === outcome).length;
}

function compareRows(a: StudentRosterRow, b: StudentRosterRow, column: Column, mode: number) {
  if (column === "family") return compareText(a.family, b.family) * (mode === 1 ? -1 : 1);
  if (column === "student") {
    const field = mode < 2 ? "studentFirst" : "studentLast";
    return compareText(a[field], b[field]) * (mode % 2 ? -1 : 1);
  }
  if (column === "parent") {
    const field = mode < 2 ? "payerName" : "payerRelationship";
    return compareText(a[field], b[field]) * (mode % 2 ? -1 : 1);
  }
  if (column === "day") return (a.dayOrder - b.dayOrder) * (mode === 1 ? -1 : 1);
  if (column === "time") return (a.timeMinutes - b.timeMinutes) * (mode === 1 ? -1 : 1);
  if (column === "teacher" || column === "place") return compareText(a[column], b[column]) * (mode === 1 ? -1 : 1);
  const monthOutcomes: Array<LessonOutcome | "total"> = ["completed", "no_show", "rescheduled", "cancelled_timely", "cancelled_late", "total"];
  const metric = monthOutcomes[mode];
  const aCount = metric === "total" ? a.lessons.length : outcomeCount(a, metric);
  const bCount = metric === "total" ? b.lessons.length : outcomeCount(b, metric);
  return bCount - aCount;
}

function sortArrow(column: Column, mode: number) {
  if (column === "month") return "↓";
  return mode % 2 === 0 ? "↑" : "↓";
}

const outcomes: Record<LessonOutcome, { label: string; mark: string }> = {
  completed: { label: "Serviced", mark: "bg-brand" },
  rescheduled: { label: "Rescheduled", mark: "bg-[#7f8d8a]" },
  cancelled_timely: { label: "Cancelled in time", mark: "bg-[#756f62]" },
  cancelled_late: { label: "Late cancellation", mark: "bg-danger" },
  no_show: { label: "No-show", mark: "bg-[#9f684f]" },
  upcoming: { label: "Upcoming", mark: "border border-line bg-transparent" },
  unrecorded: { label: "Needs status", mark: "border border-danger bg-transparent" },
};

function validOrder(value: unknown): value is Column[] {
  return Array.isArray(value) && value.length === defaults.length && defaults.every((column) => value.includes(column));
}

export function StudentRosterTable({
  rows,
  monthLabel,
  initialView,
  saveView,
}: {
  rows: StudentRosterRow[];
  monthLabel: string;
  initialView?: Partial<RosterViewSettings> | null;
  saveView: (settings: RosterViewSettings) => Promise<void>;
}) {
  const startingColumns = validOrder(initialView?.columns) ? initialView.columns : defaults;
  const requestedSort = initialView?.sort;
  const startingSort = requestedSort
    && requestedSort.column in sortModes
    && Number.isInteger(requestedSort.mode)
    && requestedSort.mode >= 0
    && requestedSort.mode < sortModes[requestedSort.column].length
    ? requestedSort
    : { column: "family" as Column, mode: 0 };
  const [columns, setColumns] = useState<Column[]>(startingColumns);
  const [arranging, setArranging] = useState(false);
  const [dragging, setDragging] = useState<Column | null>(null);
  const [dropTarget, setDropTarget] = useState<{ column: Column; side: "before" | "after" } | null>(null);
  const [sort, setSort] = useState<{ column: Column; mode: number }>(startingSort);
  const [sortNotice, setSortNotice] = useState<{ column: Column; label: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const [viewSaveError, setViewSaveError] = useState(false);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  function commit(next: Column[]) {
    setColumns(next);
    persist({ columns: next, sort });
  }

  function persist(settings: RosterViewSettings) {
    const attempt = saveQueue.current.catch(() => undefined).then(() => saveView(settings));
    saveQueue.current = attempt.catch(() => undefined);
    void attempt.then(() => setViewSaveError(false), () => setViewSaveError(true));
  }

  function move(column: Column, direction: -1 | 1) {
    const index = columns.indexOf(column);
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  function cycleSort(column: Column) {
    const next = sort.column === column
      ? { column, mode: (sort.mode + 1) % sortModes[column].length }
      : { column, mode: 0 };
    setSort(next);
    persist({ columns, sort: next });
    setSortNotice({ column, label: sortModes[column][next.mode] });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setSortNotice(null), 1500);
  }

  function cell(row: StudentRosterRow, column: Column) {
    if (column === "student") return <Link href={`/schools/${row.schoolId}/students/${row.id}`} className="border-b border-transparent pb-1 hover:border-brand hover:text-brand">{row.student}</Link>;
    if (column === "family" && row.billingAccountId) return <Link href={`/schools/${row.schoolId}/families/${row.billingAccountId}`} className="border-b border-transparent pb-1 hover:border-brand hover:text-brand">{row.family}</Link>;
    if (column !== "month") return <span className={column === "teacher" || column === "place" ? "text-sm leading-5 text-muted" : ""}>{row[column]}</span>;
    const counts = row.lessons.reduce<Partial<Record<LessonOutcome, number>>>((total, lesson) => {
      total[lesson.outcome] = (total[lesson.outcome] ?? 0) + 1;
      return total;
    }, {});
    return (
      <div>
        <div className="flex gap-1" aria-label={`${row.lessons.length} lessons in ${monthLabel}`}>
          {row.lessons.map((lesson) => <span key={lesson.id} title={outcomes[lesson.outcome].label} className={`h-3 min-w-4 flex-1 ${outcomes[lesson.outcome].mark}`} />)}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          {row.lessons.length ? Object.entries(counts).map(([outcome, count]) => `${count} ${outcomes[outcome as LessonOutcome].label.toLowerCase()}`).join(" · ") : "No lessons this month"}
        </p>
      </div>
    );
  }

  return (
    <section className="border-t border-line py-10" aria-labelledby="student-roster-heading">
      <div className="flex flex-wrap items-end justify-between gap-5 pb-6">
        <div>
          <h2 id="student-roster-heading" className="font-display text-4xl">Students.</h2>
          <p className="mt-2 text-sm text-muted">{rows.length} active · actual occurrences in {monthLabel}</p>
        </div>
        <button type="button" onClick={() => setArranging((value) => !value)} aria-expanded={arranging} className="border-b border-line pb-2 text-sm text-muted hover:border-brand hover:text-ink">Arrange columns</button>
      </div>

      {arranging ? <div className="flex items-center justify-between border-t border-line px-3 py-3 text-xs text-muted"><span>Drag the headers into place, or use the arrows inside each column.</span><button type="button" onClick={() => commit(defaults)} className="text-brand">Reset order</button></div> : null}

      <HorizontalScrollFrame label="student table">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-line text-xs text-muted">
              {columns.map((column, index) => (
                <th
                  key={column}
                  draggable
                  onDragStart={() => setDragging(column)}
                  onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    const box = event.currentTarget.getBoundingClientRect();
                    setDropTarget({ column, side: event.clientX < box.left + box.width / 2 ? "before" : "after" });
                  }}
                  onDrop={() => {
                    if (!dragging || dragging === column) return;
                    const next = columns.filter((item) => item !== dragging);
                    const targetIndex = next.indexOf(column) + (dropTarget?.side === "after" ? 1 : 0);
                    next.splice(targetIndex, 0, dragging);
                    commit(next);
                    setDragging(null);
                    setDropTarget(null);
                  }}
                  className={`${definitions[column].width} group relative cursor-grab px-4 py-4 font-normal first:pl-0 ${arranging ? "bg-surface text-ink" : ""} ${dragging === column ? "cursor-grabbing opacity-35" : ""}`}
                  title={`Drag to move ${definitions[column].label}`}
                >
                  {dropTarget?.column === column ? <span className={`absolute inset-y-0 w-0.5 bg-brand ${dropTarget.side === "before" ? "left-0" : "right-0"}`} /> : null}
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-brand"><DragHandle active={arranging || dragging === column} /><span className="text-muted group-hover:text-ink">{definitions[column].label}</span></span>
                    <button
                      type="button"
                      draggable={false}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => cycleSort(column)}
                      className={`px-2 py-1 text-sm ${sort.column === column ? "text-brand" : "text-muted hover:text-ink"}`}
                      aria-label={`Sort ${definitions[column].label}; current option ${sortModes[column][sort.column === column ? sort.mode : 0]}`}
                      title={sort.column === column ? sortModes[column][sort.mode] : `Sort by ${definitions[column].label}`}
                    >{sort.column === column ? sortArrow(column, sort.mode) : "↕"}</button>
                    {sortNotice?.column === column ? (
                      <span role="status" aria-live="polite" className="absolute top-[calc(100%-1px)] right-2 z-20 border border-brand bg-canvas px-3 py-2 text-xs whitespace-nowrap text-ink">
                        <span className="mr-2 text-brand">↓</span>{sortNotice.label}
                      </span>
                    ) : null}
                    {arranging ? (
                      <span className="flex" aria-label={`Move ${definitions[column].label}`}>
                        <button type="button" disabled={index === 0} onClick={() => move(column, -1)} className="px-2 py-1 text-muted hover:text-ink disabled:opacity-20" aria-label={`Move ${definitions[column].label} left`}>←</button>
                        <button type="button" disabled={index === columns.length - 1} onClick={() => move(column, 1)} className="px-2 py-1 text-muted hover:text-ink disabled:opacity-20" aria-label={`Move ${definitions[column].label} right`}>→</button>
                      </span>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => compareRows(a, b, sort.column, sort.mode) || compareText(a.student, b.student)).map((row) => (
              <tr key={row.id} className="border-b border-line/70 align-top last:border-0 hover:bg-surface/40">
                {columns.map((column) => <td key={column} className="px-4 py-5 first:pl-0">{cell(row, column)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScrollFrame>
      <p className="mt-3 text-xs text-muted">Sorted by {sortModes[sort.column][sort.mode]}. Click the arrow again to cycle that column’s sort.</p>
      {viewSaveError ? <p role="alert" className="mt-2 border-l border-danger pl-3 text-xs text-danger">This view could not be saved. Your data is unchanged; try moving or sorting a column again.</p> : null}
    </section>
  );
}
