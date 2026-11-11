"use client";

import { useEffect, useState } from "react";
import { MdCalendarMonth, MdClose, MdEventAvailable, MdReceiptLong } from "react-icons/md";
import type { DashboardSectionId } from "@/lib/dashboard-layout";

type BriefingItem={section:DashboardSectionId;label:string;detail:string;icon:typeof MdCalendarMonth;color:string};

export function DailyBriefing({schoolId,profileId,dateKey,dateLabel,lessonNames,teacherLessons,invoiceCount,rescheduleCount,forceOpen=false}:{schoolId:string;profileId:string;dateKey:string;dateLabel:string;lessonNames:string[];teacherLessons:Array<{name:string;count:number}>;invoiceCount:number;rescheduleCount:number;forceOpen?:boolean}){
  const[open,setOpen]=useState(false);
  useEffect(()=>{
    if(forceOpen){const frame=window.requestAnimationFrame(()=>setOpen(true));return()=>window.cancelAnimationFrame(frame);}
    const key=`common-time:daily-briefing-v2:${profileId}:${schoolId}:${dateKey}`;
    try{
      if(window.localStorage.getItem(key))return;
      window.localStorage.setItem(key,"seen");
    }catch{}
    const frame=window.requestAnimationFrame(()=>setOpen(true));
    return()=>window.cancelAnimationFrame(frame);
  },[dateKey,forceOpen,profileId,schoolId]);

  if(!open)return null;
  const lessonCount=lessonNames.length;
  const shownNames=lessonNames.slice(0,5);
  const names=shownNames.length?`${new Intl.ListFormat("en-US",{style:"long",type:"conjunction"}).format(shownNames)}${lessonNames.length>shownNames.length?` and ${lessonNames.length-shownNames.length} more`:""}`:"";
  const shownTeachers=teacherLessons.slice(0,4);
  const teacherSummary=shownTeachers.map((teacher)=>`${teacher.name} has ${teacher.count} ${teacher.count===1?"lesson":"lessons"}`).join(" · ");
  const lessonLabel=teacherLessons.length>1?`${teacherSummary}${teacherLessons.length>shownTeachers.length?` · ${teacherLessons.length-shownTeachers.length} more teachers`:""}`:lessonCount?`Today you have ${names}`:"No lessons today";
  const items:BriefingItem[]=[
    {section:"calendar",label:lessonLabel,detail:lessonCount===1?"One lesson is on today’s calendar.":lessonCount?`${lessonCount} lessons are on today’s calendar.`:"The calendar is clear today.",icon:MdCalendarMonth,color:"#7898c7"},
    {section:"invoices",label:`${invoiceCount} ${invoiceCount===1?"invoice needs":"invoices need"} attention`,detail:invoiceCount?"Drafts, approvals, or balances are still in progress.":"Nothing in billing needs attention.",icon:MdReceiptLong,color:"#c98272"},
    {section:"scheduling",label:`${rescheduleCount} ${rescheduleCount===1?"lesson needs":"lessons need"} a time`,detail:rescheduleCount?"Replacement lesson time is waiting to be scheduled.":"No replacement lessons are waiting.",icon:MdEventAvailable,color:"#79a48a"},
  ];
  function visit(section:DashboardSectionId){
    setOpen(false);
    window.requestAnimationFrame(()=>document.getElementById(`dashboard-section-${section}`)?.scrollIntoView({behavior:"smooth",block:"start"}));
  }
  return <div className="fixed inset-0 z-[170] grid place-items-end bg-[var(--ui-overlay)] sm:place-items-center sm:px-5" role="dialog" aria-modal="true" aria-labelledby="daily-briefing-title">
    <section className="relative max-h-[calc(100dvh-0.5rem)] w-full max-w-4xl overflow-y-auto rounded-t-card border border-brand/25 bg-canvas px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-card sm:px-12 sm:py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-75" style={{background:"radial-gradient(circle at 92% 8%, color-mix(in srgb, #e5a38e 30%, transparent) 0%, transparent 31%), radial-gradient(circle at 7% 95%, color-mix(in srgb, #84abc9 24%, transparent) 0%, transparent 34%), radial-gradient(circle at 62% 110%, color-mix(in srgb, #8fba99 20%, transparent) 0%, transparent 32%)"}}/>
      <button type="button" onClick={()=>setOpen(false)} aria-label="Close today’s welcome" className="absolute right-3 top-3 z-30 grid size-9 place-items-center rounded-full text-xl text-muted transition hover:bg-canvas/70 hover:text-ink"><MdClose/></button>
      <div className="relative z-10 max-w-2xl"><p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">{dateLabel}</p>
      <h2 id="daily-briefing-title" className="mt-2 font-display text-4xl tracking-[-0.04em] sm:mt-3 sm:text-6xl">Welcome to today.</h2>
      <p className="mt-4 text-sm leading-7 text-muted">A quick look at the day ahead. Choose an area whenever you’re ready.</p></div>
      <div className="relative z-10 mt-6 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
        {items.map((item)=>{const Icon=item.icon;return <button key={item.section} type="button" onClick={()=>visit(item.section)} className="grid grid-cols-[auto_1fr] gap-x-3 rounded-card border p-4 text-left transition duration-200 hover:-translate-y-1 hover:shadow-[var(--ui-shadow-soft)] sm:block sm:min-h-56 sm:p-6" style={{background:`color-mix(in srgb, ${item.color} 17%, var(--ui-canvas))`,borderColor:`color-mix(in srgb, ${item.color} 38%, var(--ui-line))`}}>
          <span className="grid size-11 place-items-center rounded-full" style={{background:`color-mix(in srgb, ${item.color} 24%, var(--ui-canvas))`,color:item.color}}><Icon aria-hidden className="text-2xl"/></span>
          <span className="block self-center text-sm font-medium leading-5 text-ink sm:mt-5 sm:text-base sm:leading-6">{item.label}</span>
          <span className="col-start-2 mt-1 block text-xs leading-5 text-muted sm:mt-3 sm:text-sm sm:leading-6">{item.detail}</span>
          <span className="col-start-2 mt-2 block text-xs font-medium sm:mt-6" style={{color:item.color}}>Go there →</span>
        </button>;})}
      </div>
    </section>
  </div>;
}
