"use client";

import { useLayoutEffect,useRef,useState,useTransition,type ReactNode } from "react";
import { MdClose,MdDragIndicator,MdExpandMore,MdExpandLess,MdInfoOutline,MdKeyboardArrowDown,MdKeyboardArrowUp,MdMoreHoriz } from "react-icons/md";
import { defaultDashboardLayout,normalizeDashboardLayout,type DashboardLayoutSettings,type DashboardSectionId } from "@/lib/dashboard-layout";

type DashboardSection={id:DashboardSectionId;title:string;description:string;content:ReactNode;hasMenu?:boolean};

export function DashboardLayout({schoolId,sections,initialSettings,save,heading}:{schoolId:string;sections:DashboardSection[];initialSettings:unknown;save:(schoolId:string,settings:DashboardLayoutSettings)=>Promise<void>;heading:ReactNode}){
  const available=sections.map((section)=>section.id);
  const initial=normalizeDashboardLayout(initialSettings,available);
  const[settings,setSettings]=useState(initial);
  const[menu,setMenu]=useState<DashboardSectionId|null>(null);
  const[info,setInfo]=useState<DashboardSectionId|null>(null);
  const[customizing,setCustomizing]=useState(false);
  const[savePending,startSaving]=useTransition();
  const[saveError,setSaveError]=useState("");
  const[dragging,setDragging]=useState<DashboardSectionId|null>(null);
  const[dropTarget,setDropTarget]=useState<{id:DashboardSectionId;after:boolean}|null>(null);
  const sectionRefs=useRef(new Map<DashboardSectionId,HTMLDivElement>());
  const modalRowRefs=useRef(new Map<DashboardSectionId,HTMLDivElement>());
  const previousSectionRects=useRef(new Map<DashboardSectionId,DOMRect>());
  const previousRowRects=useRef(new Map<DashboardSectionId,DOMRect>());
  const byId=new Map(sections.map((section)=>[section.id,section]));

  function capturePositions(){
    previousSectionRects.current=new Map([...sectionRefs.current].map(([id,node])=>[id,node.getBoundingClientRect()]));
    previousRowRects.current=new Map([...modalRowRefs.current].map(([id,node])=>[id,node.getBoundingClientRect()]));
  }
  useLayoutEffect(()=>{
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    for(const[id,node]of sectionRefs.current){const before=previousSectionRects.current.get(id);if(!before)continue;const after=node.getBoundingClientRect(),delta=before.top-after.top;if(delta)node.animate([{transform:`translateY(${delta}px)`},{transform:"translateY(0)"}],{duration:320,easing:"cubic-bezier(.22,.8,.25,1)"});}
    for(const[id,node]of modalRowRefs.current){const before=previousRowRects.current.get(id);if(!before)continue;const after=node.getBoundingClientRect(),delta=before.top-after.top;if(delta)node.animate([{transform:`translateY(${delta}px)`},{transform:"translateY(0)"}],{duration:320,easing:"cubic-bezier(.22,.8,.25,1)"});}
    previousSectionRects.current.clear();previousRowRects.current.clear();
  },[settings.order]);

  function update(next:DashboardLayoutSettings){
    setSettings(next);
    setSaveError("");
    startSaving(()=>{void save(schoolId,next).catch(()=>setSaveError("The layout changed here, but could not be saved. Try again before leaving the dashboard."));});
  }
  function move(id:DashboardSectionId,direction:-1|1){
    const index=settings.order.indexOf(id),target=index+direction;
    if(index<0||target<0||target>=settings.order.length)return;
    capturePositions();
    const order=[...settings.order];[order[index],order[target]]=[order[target],order[index]];
    update({...settings,order});setMenu(null);
  }
  function drop(id:DashboardSectionId,target:DashboardSectionId,after:boolean){
    if(id===target)return;
    capturePositions();
    const order=settings.order.filter((item)=>item!==id),targetIndex=order.indexOf(target);
    order.splice(targetIndex+(after?1:0),0,id);
    update({...settings,order});
  }
  function toggle(id:DashboardSectionId){
    const minimized=settings.minimized.includes(id)?settings.minimized.filter((item)=>item!==id):[...settings.minimized,id];
    update({...settings,minimized});setMenu(null);
  }
  function reset(){
    capturePositions();
    const next=normalizeDashboardLayout(defaultDashboardLayout,available);
    update(next);
  }

  const infoSection=info?byId.get(info):null;
  return <>
    <header className="mb-10 flex flex-wrap items-start justify-between gap-5"><div>{heading}</div><div className="flex flex-col items-end gap-2 pt-1 sm:pt-2"><button type="button" onClick={()=>setCustomizing(true)} className="rounded-control px-2 py-1.5 text-xs text-muted transition hover:bg-brand/10 hover:text-brand">Reorder dashboard</button>{savePending?<span className="text-xs text-muted">Saving layout…</span>:null}{saveError?<span role="alert" className="max-w-sm text-right text-xs text-danger">{saveError}</span>:null}</div></header>
    <div className="space-y-7">
      {settings.order.map((id,index)=>{const section=byId.get(id);if(!section)return null;const hasMenu=section.hasMenu!==false;const minimized=hasMenu&&settings.minimized.includes(id);return <div key={id} ref={(node)=>{if(node)sectionRefs.current.set(id,node);else sectionRefs.current.delete(id);}} className="relative">
        {minimized?<div className="ui-card flex items-center justify-between gap-5 px-5 py-4"><div><p className="text-xs uppercase tracking-[0.14em] text-brand">Minimized</p><h2 className="mt-1 font-display text-2xl">{section.title}</h2></div><SectionMenu id={id} index={index} count={settings.order.length} minimized menu={menu} setMenu={setMenu} move={move} toggle={toggle} showInfo={()=>{setInfo(id);setMenu(null);}}/></div>:<>{hasMenu?<div className="absolute right-4 top-4 z-40"><SectionMenu id={id} index={index} count={settings.order.length} minimized={false} menu={menu} setMenu={setMenu} move={move} toggle={toggle} showInfo={()=>{setInfo(id);setMenu(null);}}/></div>:null}{section.content}</>}
      </div>;})}
    </div>
      {customizing?<Modal title="Reorder dashboard" close={()=>setCustomizing(false)}><p className="text-sm leading-6 text-muted">Drag sections into place or use the arrow buttons. Movement is saved automatically.</p><div className="mt-5 divide-y divide-line border-y border-line">{settings.order.map((id,index)=>{const section=byId.get(id);if(!section)return null;const targeted=dropTarget?.id===id;return <div key={id} ref={(node)=>{if(node)modalRowRefs.current.set(id,node);else modalRowRefs.current.delete(id);}} draggable onDragStart={()=>{setDragging(id);setDropTarget(null);}} onDragEnd={()=>{setDragging(null);setDropTarget(null);}} onDragOver={(event)=>{event.preventDefault();const box=event.currentTarget.getBoundingClientRect();setDropTarget({id,after:event.clientY>box.top+box.height/2});}} onDrop={(event)=>{event.preventDefault();if(dragging)drop(dragging,id,dropTarget?.id===id&&dropTarget.after);setDragging(null);setDropTarget(null);}} className={`relative grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 transition-colors ${dragging===id?"opacity-45":targeted?"bg-brand/10":""}`}><span aria-hidden className="cursor-grab text-xl text-muted active:cursor-grabbing"><MdDragIndicator/></span><p className="text-sm font-medium">{section.title}</p><div className="flex items-center gap-1"><button type="button" disabled={index===0} onClick={()=>move(id,-1)} aria-label={`Move ${section.title} up`} className="grid size-9 place-items-center rounded-control border border-line transition disabled:opacity-30"><MdKeyboardArrowUp/></button><button type="button" disabled={index===settings.order.length-1} onClick={()=>move(id,1)} aria-label={`Move ${section.title} down`} className="grid size-9 place-items-center rounded-control border border-line transition disabled:opacity-30"><MdKeyboardArrowDown/></button></div>{targeted?<span className={`absolute inset-x-0 h-0.5 bg-brand ${dropTarget.after?"bottom-0":"top-0"}`}/>:null}</div>;})}</div><div className="mt-5 flex items-center justify-between gap-4"><button type="button" onClick={reset} className="text-sm text-muted underline-offset-4 hover:underline">Reset default order</button><button type="button" onClick={()=>setCustomizing(false)} className="rounded-control bg-ink px-4 py-2 text-sm text-canvas">Done</button></div></Modal>:null}
    {infoSection?<Modal title={infoSection.title} close={()=>setInfo(null)}><p className="text-sm leading-7 text-muted">{infoSection.description}</p><button type="button" onClick={()=>setInfo(null)} className="mt-6 rounded-control bg-ink px-4 py-2 text-sm text-canvas">Got it</button></Modal>:null}
  </>;
}

function SectionMenu({id,index,count,minimized,menu,setMenu,move,toggle,showInfo}:{id:DashboardSectionId;index:number;count:number;minimized:boolean;menu:DashboardSectionId|null;setMenu:(id:DashboardSectionId|null)=>void;move:(id:DashboardSectionId,direction:-1|1)=>void;toggle:(id:DashboardSectionId)=>void;showInfo:()=>void}){
  const open=menu===id;
  return <div className="relative"><button type="button" aria-label="Section options" aria-expanded={open} onClick={()=>setMenu(open?null:id)} className="grid size-8 place-items-center rounded-full text-lg text-muted transition hover:bg-brand/10 hover:text-brand"><MdMoreHoriz/></button>{open?<div className="absolute right-0 top-9 z-40 w-48 rounded-control border border-line bg-canvas p-1.5 text-sm shadow-xl"><button type="button" onClick={()=>toggle(id)} className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left hover:bg-brand/10">{minimized?<MdExpandMore/>:<MdExpandLess/>}{minimized?"Maximize":"Minimize"}</button><button type="button" disabled={index===0} onClick={()=>move(id,-1)} className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left hover:bg-brand/10 disabled:opacity-35"><MdKeyboardArrowUp/>Move up</button><button type="button" disabled={index===count-1} onClick={()=>move(id,1)} className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left hover:bg-brand/10 disabled:opacity-35"><MdKeyboardArrowDown/>Move down</button><button type="button" onClick={showInfo} className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left hover:bg-brand/10"><MdInfoOutline/>About this section</button></div>:null}</div>;
}

function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
  return <div className="fixed inset-0 z-[150] grid place-items-center px-5" role="dialog" aria-modal="true" aria-labelledby="dashboard-modal-title"><button type="button" aria-label="Close" onClick={close} className="absolute inset-0 bg-[var(--ui-overlay)]"/><section className="relative max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-card border border-brand/30 bg-canvas p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-5"><h2 id="dashboard-modal-title" className="font-display text-3xl">{title}</h2><button type="button" onClick={close} aria-label="Close" className="grid size-9 place-items-center rounded-full text-xl text-muted hover:bg-surface-raised"><MdClose/></button></div><div className="mt-5">{children}</div></section></div>;
}
