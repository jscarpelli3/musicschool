"use client";

import { useEffect, useState } from "react";
import { MdCalendarMonth, MdEventAvailable, MdReceiptLong } from "react-icons/md";
import type { DashboardSectionId } from "@/lib/dashboard-layout";
import type { SchoolWeather } from "@/lib/weather/school-weather";

type BriefingItem={section:DashboardSectionId;label:string;detail:string;icon:typeof MdCalendarMonth};

export function DailyBriefing({schoolId,profileId,dateKey,dateLabel,lessonNames,invoiceCount,rescheduleCount,weather,forceOpen=false}:{schoolId:string;profileId:string;dateKey:string;dateLabel:string;lessonNames:string[];invoiceCount:number;rescheduleCount:number;weather:SchoolWeather|null;forceOpen?:boolean}){
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
  const items:BriefingItem[]=[
    {section:"calendar",label:lessonCount?`Today you have ${names}`:"No lessons today",detail:lessonCount===1?"One student is on today’s calendar.":lessonCount?`${lessonCount} students are on today’s calendar.`:"The calendar is clear today.",icon:MdCalendarMonth},
    {section:"invoices",label:`${invoiceCount} ${invoiceCount===1?"invoice needs":"invoices need"} attention`,detail:invoiceCount?"Drafts, approvals, or balances are still in progress.":"Nothing in billing needs attention.",icon:MdReceiptLong},
    {section:"scheduling",label:`${rescheduleCount} ${rescheduleCount===1?"lesson needs":"lessons need"} a time`,detail:rescheduleCount?"Replacement lesson time is waiting to be scheduled.":"No replacement lessons are waiting.",icon:MdEventAvailable},
  ];
  function visit(section:DashboardSectionId){
    setOpen(false);
    window.requestAnimationFrame(()=>document.getElementById(`dashboard-section-${section}`)?.scrollIntoView({behavior:"smooth",block:"start"}));
  }
  return <div className="fixed inset-0 z-[170] grid place-items-center bg-[var(--ui-overlay)] px-5" role="dialog" aria-modal="true" aria-labelledby="daily-briefing-title">
    <section className="relative w-full max-w-2xl overflow-hidden rounded-card border border-brand/30 bg-canvas p-6 shadow-2xl sm:p-9">
      {weather?<WeatherCorner weather={weather}/>:null}
      <div className={weather?"relative z-10 max-w-[65%] sm:max-w-[68%]":"relative z-10"}><p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">{dateLabel}</p>
      <h2 id="daily-briefing-title" className="mt-2 font-display text-4xl tracking-[-0.035em] sm:text-5xl">Welcome to today.</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Here is the shape of the day. Choose an area to begin.</p></div>
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

function WeatherCorner({weather}:{weather:SchoolWeather}){
  const color={clear:"#f3b34b",cloudy:"#8aa2ae",rain:"#4f86a6",snow:"#93b9c8",storm:"#776a9c",fog:"#9aa6a8"}[weather.kind];
  return <div aria-label={`${weather.summary}${weather.temperature?`, ${weather.temperature}`:""}. National Weather Service forecast.`} className="absolute right-0 top-0 h-52 w-64 overflow-hidden" style={{background:`radial-gradient(circle at 100% 0%, color-mix(in srgb, ${color} 48%, var(--ui-canvas)) 0%, color-mix(in srgb, ${color} 18%, transparent) 48%, transparent 74%)`}}>
    <div className="absolute right-6 top-8 max-w-40 text-right">{weather.temperature?<p className="font-display text-4xl leading-none text-ink">{weather.temperature}</p>:null}<p className="mt-2 text-sm font-medium text-ink">{weather.summary}</p><p className="mt-2 text-[9px] uppercase tracking-[0.1em] text-muted">National Weather Service</p></div>
  </div>;
}
