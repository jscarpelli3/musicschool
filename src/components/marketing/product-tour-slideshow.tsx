"use client";

import Image from "next/image";
import {useCallback,useEffect,useRef,useState} from "react";

type Slide={src:string;title:string;text:string;alt:string};

const desktopSlides=[
 {src:"/images/product-tour/dashboard.webp",title:"Know what needs attention",text:"See invoice progress, scheduling work, and the school’s current activity from one calm dashboard.",alt:"Common Time dashboard showing invoices in several stages"},
 {src:"/images/product-tour/students.webp",title:"Keep the teaching week attached to real people",text:"Find each student’s regular time, teacher, family, and current month without searching across separate lists.",alt:"Common Time student directory with lesson times and teachers"},
 {src:"/images/product-tour/family-calendar.webp",title:"See a family’s lessons together",text:"Open one family record to understand who is learning, when their lessons happen, and what still needs attention.",alt:"Common Time family calendar showing two students’ recurring lessons"},
 {src:"/images/product-tour/invoice-workspace.webp",title:"Build invoices from the lessons you taught",text:"Review dates and times first, then add a charge, credit, or lesson before asking the payer to approve.",alt:"Common Time invoice workspace with lesson line items and adjustments"},
 {src:"/images/product-tour/offerings.webp",title:"Set up the lessons you actually sell",text:"Keep durations, prices, and billing reminders clear while retaining control over how each offering is collected.",alt:"Common Time school offerings with lesson lengths and prices"},
 {src:"/images/product-tour/notifications.webp",title:"Choose what deserves your attention",text:"Control billing, schedule, lesson, and daily notifications without losing the in-app record.",alt:"Common Time notification settings"},
] as const satisfies readonly Slide[];

type TourView="desktop"|"mobile";

// Add the mobile screenshot set here when it is ready. The view toggle appears
// automatically as soon as both collections contain slides.
const mobileSlides:readonly Slide[]=[];
const slideSets:Record<TourView,readonly Slide[]>={desktop:desktopSlides,mobile:mobileSlides};

export function ProductTourSlideshow(){
 const [view,setView]=useState<TourView>("desktop");
 const [active,setActive]=useState(0);
 const [paused,setPaused]=useState(false);
 const touchStart=useRef<{x:number;y:number}|null>(null);
 const slides=slideSets[view];
 const hasViewToggle=desktopSlides.length>0&&mobileSlides.length>0;
 const show=useCallback((index:number)=>setActive((index+slides.length)%slides.length),[slides.length]);

 const chooseView=(nextView:TourView)=>{
  if(slideSets[nextView].length===0)return;
  setView(nextView);
  setActive(0);
 };

 const finishSwipe=(x:number,y:number)=>{
  const start=touchStart.current;
  touchStart.current=null;
  if(!start)return;
  const horizontal=x-start.x;
  const vertical=y-start.y;
  if(Math.abs(horizontal)<50||Math.abs(horizontal)<=Math.abs(vertical))return;
  show(active+(horizontal<0?1:-1));
 };

 useEffect(()=>{
  if(paused||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const timer=window.setInterval(()=>setActive(current=>(current+1)%slides.length),8000);
  return()=>window.clearInterval(timer);
 },[paused,slides.length]);

 return <div className="relative mt-10 px-0 sm:px-14" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={(event)=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false)}}>
  {hasViewToggle?<div className="mb-5 flex justify-center" role="group" aria-label="Choose screenshot size"><div className="inline-flex rounded-full border border-line bg-canvas p-1">{(["desktop","mobile"] as const).map(option=><button key={option} type="button" onClick={()=>chooseView(option)} aria-pressed={view===option} className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.12em] transition ${view===option?"bg-ink text-canvas":"text-muted hover:text-ink"}`}>{option}</button>)}</div></div>:null}
  <button type="button" onClick={()=>show(active-1)} className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-2xl text-ink shadow-lg transition hover:border-brand hover:text-brand sm:flex" aria-label="Show previous product screen">‹</button>
  <button type="button" onClick={()=>show(active+1)} className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-2xl text-ink shadow-lg transition hover:border-brand hover:text-brand sm:flex" aria-label="Show next product screen">›</button>
  <div className="touch-pan-y overflow-hidden rounded-card border border-line bg-ink shadow-2xl shadow-ink/15" onTouchStart={(event)=>{const touch=event.changedTouches[0];touchStart.current={x:touch.clientX,y:touch.clientY}}} onTouchEnd={(event)=>{const touch=event.changedTouches[0];finishSwipe(touch.clientX,touch.clientY)}} onTouchCancel={()=>{touchStart.current=null}}>
   <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3" aria-hidden="true"><span className="h-2.5 w-2.5 rounded-full bg-brand"/><span className="h-2.5 w-2.5 rounded-full bg-canvas/35"/><span className="h-2.5 w-2.5 rounded-full bg-canvas/20"/><span className="ml-3 text-[0.65rem] uppercase tracking-[0.14em] text-canvas/55">Common Time</span></div>
   <div className="flex transition-transform duration-700 ease-in-out" style={{transform:`translateX(-${active*100}%)`}}>
    {slides.map((slide,index)=><article key={slide.src} className="w-full shrink-0" aria-hidden={index!==active}><div className="relative aspect-[1440/941] bg-canvas/10"><Image src={slide.src} alt={slide.alt} fill sizes="(min-width: 1200px) 1056px, 100vw" priority={index===0} draggable={false} className="select-none object-contain"/></div><div className="grid gap-3 border-t border-white/10 px-5 py-5 text-canvas sm:grid-cols-[auto_1fr] sm:gap-6 sm:px-7"><p className="text-xs uppercase tracking-[0.14em] text-brand">{String(index+1).padStart(2,"0")} / {String(slides.length).padStart(2,"0")}</p><div><h3 className="font-display text-2xl sm:text-3xl">{slide.title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-canvas/65">{slide.text}</p></div></div></article>)}
   </div>
  </div>
  <div className="mt-5 flex items-center justify-between gap-4"><button type="button" onClick={()=>show(active-1)} className="text-2xl text-ink sm:hidden" aria-label="Show previous product screen">‹</button><div className="flex flex-wrap justify-center gap-2" aria-label="Choose a product screen">{slides.map((slide,index)=><button key={slide.title} type="button" onClick={()=>show(index)} aria-label={`Show ${slide.title}`} aria-current={index===active?"true":undefined} className={`h-2.5 rounded-full transition-all duration-300 ${index===active?"w-10 bg-brand":"w-2.5 bg-line hover:bg-brand/50"}`}/>)}</div><button type="button" onClick={()=>show(active+1)} className="text-2xl text-ink sm:hidden" aria-label="Show next product screen">›</button></div>
  <p className="sr-only" aria-live="polite">Showing {slides[active].title}</p>
 </div>;
}
