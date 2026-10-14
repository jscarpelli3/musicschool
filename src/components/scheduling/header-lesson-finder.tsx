"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { LessonOpeningFinder } from "./lesson-opening-finder";
import { LessonCreationDialog, type LessonCreationOptions } from "./lesson-creation-dialog";

type Slot = { dateKey: string; time: string; teacherId: string; productId?: string };

export function HeaderLessonFinder({ schoolId, timeZone, options, studentIdsByFamily }: { schoolId: string; timeZone: string; options: LessonCreationOptions; studentIdsByFamily: Record<string, string[]> }) {
  const pathname = usePathname();
  const [slot, setSlot] = useState<Slot | null>(null);
  const contextualOptions = useMemo(() => {
    const studentId = pathname.match(/\/students\/([^/]+)/)?.[1];
    const familyId = pathname.match(/\/families\/([^/]+)/)?.[1];
    const teacherId = pathname.match(/\/staff\/([^/]+)/)?.[1];
    const students = studentId ? options.students.filter((student) => student.id === studentId) : familyId ? options.students.filter((student) => (studentIdsByFamily[familyId] ?? []).includes(student.id)) : options.students;
    const teachers = teacherId ? options.teachers.filter((teacher) => teacher.id === teacherId) : options.teachers;
    return { ...options, students, teachers, defaultStudentId: studentId ?? (familyId && students.length === 1 ? students[0]?.id : undefined) };
  }, [options, pathname, studentIdsByFamily]);
  return <>
    <LessonOpeningFinder triggerVariant="nav" options={contextualOptions} timeZone={timeZone} onChoose={setSlot} onManualAdd={() => setSlot({ dateKey: contextualOptions.today, time: "", teacherId: contextualOptions.teachers.length === 1 ? contextualOptions.teachers[0].id : "" })} />
    {slot ? <LessonCreationDialog schoolId={schoolId} slot={slot} options={contextualOptions} lockTeacher={contextualOptions.teachers.length === 1} timeZone={timeZone} onClose={() => setSlot(null)} /> : null}
  </>;
}
