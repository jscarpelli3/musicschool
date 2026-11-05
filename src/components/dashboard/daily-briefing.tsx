"use client";

import { useEffect, useState } from "react";
import { MdCalendarMonth, MdEventAvailable, MdReceiptLong } from "react-icons/md";
import type { DashboardSectionId } from "@/lib/dashboard-layout";

type BriefingItem={section:DashboardSectionId;label:string;detail:string;icon:typeof MdCalendarMonth};

export function DailyBriefing({schoolId,profileId,dateKey,dateLabel,lessonCount,invoiceCount,rescheduleCount}:{schoolId:string;profileId:string;dateKey:string;dateLabel:string;lessonCount:number;invoiceCount:number;rescheduleCount:number}){
  const[open,setOpen]=useState(false);
  useEffect(()=>{
    const key=`common-time:daily-briefing:${profileId}:${schoolId}:${dateKey}`;
    try{
      if(window.localStorage.getItem(key))return;
      window.localStorage.setItem(key,"seen");
    }catch{}
    const frame=window.requestAnimationFrame(()=>setOpen(true));
    return()=>window.cancelAnimationFrame(frame);
  },[dateKey,profileId,schoolId]);

  if(!open)return null;
  const items:BriefingItem[]=[
    {section:"calendar",label:`${lessonCount} ${lessonCount===1?"lesson":"lessons"} today`,detail:lessonCount?"Your teaching day is on the calendar.":"The calendar is clear today.",icon:MdCalendarMonth},
    {section:"invoices",label:`${invoiceCount} ${invoiceCount===1?"invoice needs":"invoices need"} attention`,detail:invoiceCount?"Drafts, approvals, or balances are still in progress.":"Nothing in billing needs attention.",icon:MdReceiptLong},
    {section:"scheduling",label:`${rescheduleCount} ${rescheduleCount===1?"lesson needs":"lessons need"} a time`,detail:rescheduleCount?"Replacement lesson time is waiting to be scheduled.":"No replacement lessons are waiting.",icon:MdEventAvailable},
  ];
  function visit(section:DashboardSectionId){
    setOpen(false);
    window.requestAnimationFrame(()=>document.getElementById(`dashboard-section-${section}`)?.scrollIntoView({behavior:"smooth",block:"start"}));
  }
  return <div className="fixed inset-0 z-[170] grid place-items-center bg-[var(--ui-overlay)] px-5" role="dialog" aria-modal="true" aria-labelledby="daily-briefing-title">
    <section className="w-full max-w-2xl rounded-card border border-brand/30 bg-canvas p-6 shadow-2xl sm:p-9">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">{dateLabel}</p>
      <h2 id="daily-briefing-title" className="mt-2 font-display text-4xl tracking-[-0.035em] sm:text-5xl">Welcome to today.</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Here is the shape of the day. Choose an area to begin.</p>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {items.map((item)=>{const Icon=item.icon;return <button key={item.section} type="button" onClick={()=>visit(item.section)} className="rounded-card border border-line p-5 text-left transition hover:-translate-y-0.5 hover:border-brand hover:bg-brand/5">
          <Icon aria-hidden className="text-2xl text-brand"/>
          <span className="mt-4 block text-sm font-medium text-ink">{item.label}</span>
          <span className="mt-2 block text-xs leading-5 text-muted">{item.detail}</span>
          <span className="mt-4 block text-xs text-brand">Go there →</span>
        </button>;})}
      </div>
    </section>
  </div>;
}
