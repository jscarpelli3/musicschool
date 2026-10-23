"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ServiceEntitlementItem } from "@/lib/scheduling/service-entitlements";
import { LessonOpeningFinder } from "./lesson-opening-finder";
import { LessonCreationDialog, type LessonCreationOptions } from "./lesson-creation-dialog";

function ScheduleEntitlement({schoolId,item,timezone,options}:{schoolId:string;item:ServiceEntitlementItem;timezone:string;options:LessonCreationOptions}){
  const router=useRouter();
  const [slot,setSlot]=useState<{dateKey:string;time:string;teacherId:string;productId?:string}|null>(null);
  const contextualOptions=useMemo(()=>({...options,
    students:options.students.filter((student)=>student.id===item.studentId),defaultStudentId:item.studentId,
    teachers:item.teacherId?options.teachers.filter((teacher)=>teacher.id===item.teacherId):options.teachers,
    products:options.products.filter((product)=>product.id===item.productId).map((product)=>({...product,durationMinutes:item.durationMinutes})),
    entitlement:{id:item.id,studentId:item.studentId,productId:item.productId,instrumentId:item.instrumentId,teacherId:item.teacherId,durationMinutes:item.durationMinutes},
  }),[item,options]);
  const manualTeacher=item.teacherId??(contextualOptions.teachers.length===1?contextualOptions.teachers[0].id:"");
  return <><LessonOpeningFinder triggerVariant="inline" options={contextualOptions} timeZone={timezone} onChoose={setSlot} onManualAdd={()=>setSlot({dateKey:contextualOptions.today,time:"",teacherId:manualTeacher,productId:item.productId})} onBrowseSchedule={()=>router.push(`/schools/${schoolId}#school-calendar`)}/>{slot?<LessonCreationDialog schoolId={schoolId} slot={slot} options={contextualOptions} lockTeacher={Boolean(item.teacherId)} timeZone={timezone} onClose={()=>setSlot(null)}/>:null}</>;
}

export function LessonsToSchedule({ schoolId, items, timezone, compact = false, lessonCreationOptions }: {
  schoolId: string; items: ServiceEntitlementItem[]; timezone: string; compact?: boolean; lessonCreationOptions?:LessonCreationOptions;
}) {
  if (!items.length) return null;
  const date = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  return <div className="divide-y divide-line border-y border-line">
    {items.map((item) => <article key={item.id} className={`grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center ${compact ? "text-sm" : ""}`}>
      <div><p className="font-medium"><Link href={`/schools/${schoolId}/students/${item.studentId}`} className="hover:text-brand">{item.studentName}</Link> · {item.productName}</p>
        <p className="mt-1 text-sm text-muted">{item.durationMinutes} minutes · from {date(item.sourceStartsAt)} · {item.teacherName && item.teacherId ? <Link href={`/schools/${schoolId}/staff/${item.teacherId}`} className="hover:text-brand">{item.teacherName}</Link> : "any teacher"}</p>
        {item.expiresAt ? <p className="mt-1 text-xs text-muted">Schedule by {date(item.expiresAt)}</p> : null}
      </div>
      {lessonCreationOptions?<ScheduleEntitlement schoolId={schoolId} item={item} timezone={timezone} options={lessonCreationOptions}/>:null}
    </article>)}
  </div>;
}
