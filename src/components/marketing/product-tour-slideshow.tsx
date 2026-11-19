"use client";

import Image from "next/image";
import {useCallback,useEffect,useState} from "react";

const slides=[
 {src:"/images/product-tour/dashboard.webp",title:"Know what needs attention",text:"See invoice progress, scheduling work, and the school’s current activity from one calm dashboard.",alt:"Common Time dashboard showing invoices in several stages"},
 {src:"/images/product-tour/students.webp",title:"Keep the teaching week attached to real people",text:"Find each student’s regular time, teacher, family, and current month without searching across separate lists.",alt:"Common Time student directory with lesson times and teachers"},
 {src:"/images/product-tour/family-calendar.webp",title:"See a family’s lessons together",text:"Open one family record to understand who is learning, when their lessons happen, and what still needs attention.",alt:"Common Time family calendar showing two students’ recurring lessons"},
 {src:"/images/product-tour/invoice-workspace.webp",title:"Build invoices from the lessons you taught",text:"Review dates and times first, then add a charge, credit, or lesson before asking the payer to approve.",alt:"Common Time invoice workspace with lesson line items and adjustments"},
 {src:"/images/product-tour/offerings.webp",title:"Set up the lessons you actually sell",text:"Keep durations, prices, and billing reminders clear while retaining control over how each offering is collected.",alt:"Common Time school offerings with lesson lengths and prices"},
 {src:"/images/product-tour/notifications.webp",title:"Choose what deserves your attention",text:"Control billing, schedule, lesson, and daily notifications without losing the in-app record.",alt:"Common Time notification settings"},
] as const;

export function ProductTourSlideshow(){
 const [active,setActive]=useState(0);
 const [paused,setPaused]=useState(false);
 const show=useCallback((index:number)=>setActive((index+slides.length)%slides.length),[]);

 useEffect(()=>{
  if(paused||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const timer=window.setInterval(()=>setActive(current=>(current+1)%slides.length),8000);
  return()=>window.clearInterval(timer);
 },[paused]);

 return <div className="mt-12" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={(event)=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false)}}>
  <div className="overflow-hidden rounded-card border border-line bg-ink shadow-2xl shadow-ink/15">
   <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3" aria-hidden="true"><span className="h-2.5 w-2.5 rounded-full bg-brand"/><span className="h-2.5 w-2.5 rounded-full bg-canvas/35"/><span className="h-2.5 w-2.5 rounded-full bg-canvas/20"/><span className="ml-3 text-[0.65rem] uppercase tracking-[0.14em] text-canvas/55">Common Time</span></div>
   <div className="relative aspect-[1440/941] bg-canvas/10">
    {slides.map((slide,index)=><Image key={slide.src} src={slide.src} alt={slide.alt} fill sizes="(min-width: 1200px) 1152px, 100vw" priority={index===0} className={`object-contain transition-opacity duration-700 ${index===active?"opacity-100":"pointer-events-none opacity-0"}`}/>) }
   </div>
  </div>
  <div className="mt-6 grid gap-5 border-b border-line pb-7 md:grid-cols-[1fr_auto] md:items-end">
   <div aria-live="polite" aria-atomic="true"><p className="text-xs uppercase tracking-[0.14em] text-brand">{String(active+1).padStart(2,"0")} / {String(slides.length).padStart(2,"0")}</p><h3 className="mt-2 font-display text-3xl sm:text-4xl">{slides[active].title}</h3><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{slides[active].text}</p></div>
   <div className="flex items-center gap-3"><button type="button" onClick={()=>show(active-1)} className="rounded-control border border-line px-4 py-2 text-sm text-ink transition hover:border-brand hover:text-brand" aria-label="Show previous product screen">Previous</button><button type="button" onClick={()=>show(active+1)} className="rounded-control bg-ink px-4 py-2 text-sm text-canvas transition hover:bg-brand" aria-label="Show next product screen">Next</button></div>
  </div>
  <div className="mt-5 flex flex-wrap gap-2" aria-label="Choose a product screen">{slides.map((slide,index)=><button key={slide.title} type="button" onClick={()=>show(index)} aria-label={`Show ${slide.title}`} aria-current={index===active?"true":undefined} className={`h-2.5 rounded-full transition-all duration-300 ${index===active?"w-10 bg-brand":"w-2.5 bg-line hover:bg-brand/50"}`}/>)}</div>
 </div>;
}
