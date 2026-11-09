"use client";

import {useEffect,useState} from "react";
import {MdAddToHomeScreen,MdClose,MdIosShare} from "react-icons/md";

type InstallChoice={outcome:"accepted"|"dismissed";platform:string};
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<InstallChoice>};
const DISMISSED_KEY="common-time:pwa-install-dismissed";
const THIRTY_DAYS=30*24*60*60*1000;

export function InstallPrompt(){
 const[event,setEvent]=useState<InstallEvent|null>(null),[ios,setIos]=useState(false),[visible,setVisible]=useState(false);
 useEffect(()=>{
  const standalone=window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
  if(standalone)return;
  const dismissed=Number(localStorage.getItem(DISMISSED_KEY)??0);if(dismissed&&Date.now()-dismissed<THIRTY_DAYS)return;
  const isIos=/iPad|iPhone|iPod/.test(navigator.userAgent),reveal=()=>window.setTimeout(()=>setVisible(true),1200);
  queueMicrotask(()=>setIos(isIos));if(isIos)reveal();
  const before=(incoming:Event)=>{incoming.preventDefault();setEvent(incoming as InstallEvent);reveal();};
  const installed=()=>{setVisible(false);setEvent(null);localStorage.removeItem(DISMISSED_KEY);};
  window.addEventListener("beforeinstallprompt",before);window.addEventListener("appinstalled",installed);
  return()=>{window.removeEventListener("beforeinstallprompt",before);window.removeEventListener("appinstalled",installed);};
 },[]);
 function dismiss(){localStorage.setItem(DISMISSED_KEY,String(Date.now()));setVisible(false);}
 async function install(){if(!event)return;await event.prompt();const choice=await event.userChoice;if(choice.outcome==="accepted")setVisible(false);else dismiss();setEvent(null);}
 if(!visible||(!event&&!ios))return null;
 return <aside role="dialog" aria-label="Install Common Time" className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-xl rounded-card border border-brand/35 bg-surface p-5 shadow-2xl sm:bottom-6"><button type="button" onClick={dismiss} aria-label="Dismiss installation prompt" className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-muted hover:bg-canvas"><MdClose aria-hidden/></button><div className="flex gap-4 pr-8"><span className="grid size-12 shrink-0 place-items-center rounded-card bg-brand/10 text-2xl text-brand"><MdAddToHomeScreen aria-hidden/></span><div><h2 className="font-display text-2xl">Put Common Time on this device</h2><p className="mt-2 text-sm leading-6 text-muted">Open it from your home screen or app launcher in its own window, just like an app.</p></div></div>{ios?<div className="mt-5 rounded-control bg-canvas p-4 text-sm leading-6"><p className="flex items-center gap-2 font-medium"><MdIosShare aria-hidden className="text-xl"/>On iPhone or iPad</p><p className="mt-1 text-muted">Tap Share, then choose <strong className="text-ink">Add to Home Screen</strong>.</p></div>:<div className="mt-5 flex flex-wrap items-center gap-4"><button type="button" onClick={()=>void install()} className="rounded-control bg-ink px-4 py-2.5 text-sm text-canvas">Install Common Time</button><button type="button" onClick={dismiss} className="text-sm text-muted">Not now</button></div>}</aside>;
}
