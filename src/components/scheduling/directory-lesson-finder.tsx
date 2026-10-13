"use client";

import { useState } from "react";
import { LessonOpeningFinder } from "./lesson-opening-finder";
import { LessonCreationDialog, type LessonCreationOptions } from "./lesson-creation-dialog";

type Slot = { dateKey: string; time: string; teacherId: string; productId?: string };

export function DirectoryLessonFinder({ schoolId, timeZone, options }: { schoolId: string; timeZone: string; options: LessonCreationOptions }) {
  const [slot, setSlot] = useState<Slot | null>(null);
  return <>
    <div className="mt-8 flex justify-center"><div className="w-[min(28rem,100%)]"><LessonOpeningFinder size="directory" options={options} timeZone={timeZone} onChoose={setSlot} /></div></div>
    {slot ? <LessonCreationDialog schoolId={schoolId} slot={slot} options={options} lockTeacher={false} timeZone={timeZone} onClose={() => setSlot(null)} /> : null}
  </>;
}
