"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AppSelect } from "@/components/ui/app-select";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";
import { MdDeleteOutline } from "react-icons/md";

export type WeeklyAvailabilityBlock = { weekday: number; start_time: string; end_time: string };
type Result = { ok: boolean; message: string };
type EditorBlock = WeeklyAvailabilityBlock & { key: string; saved: boolean };
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const presets = [
  { label: "Weekday afternoons", days: [1,2,3,4,5], start: "14:00", end: "19:00" },
  { label: "Weekday evenings", days: [1,2,3,4,5], start: "16:00", end: "20:00" },
  { label: "Broad weekdays", days: [1,2,3,4,5], start: "09:00", end: "18:00" },
  { label: "Saturday", days: [6], start: "09:00", end: "15:00" },
] as const;
const calendarDays = [1, 2, 3, 4, 5, 6, 0];
const calendarStart = 6 * 60;
const calendarEnd = 22 * 60;
const calendarMinutes = calendarEnd - calendarStart;
const calendarHeight = 448;
const snapMinutes = 15;

const minuteValue = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};
const timeValue = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const shortTime = (time: string) => {
  const minutes = minuteValue(time);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour < 12 ? "a" : "p"}`;
};

export function WeeklyAvailabilityEditor({ initialBlocks, action, compactSetup = false }: { initialBlocks: WeeklyAvailabilityBlock[]; action: (blocks: WeeklyAvailabilityBlock[]) => Promise<Result>; compactSetup?: boolean }) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => initialBlocks.map((block, index) => ({ ...block, key: `${block.weekday}-${block.start_time}-${index}`, saved: true })));
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  const [presetBackup, setPresetBackup] = useState<{ blocks: EditorBlock[]; dirty: boolean } | null>(null);
  const [savedComplete, setSavedComplete] = useState(false);
  const [showExactTimes, setShowExactTimes] = useState(!compactSetup);
  const drag = useRef<{ key: string; mode: "move" | "resize"; y: number; start: number; end: number } | null>(null);

  function changed() {
    setDirty(true);
    setRevision((current) => current + 1);
  }

  function update(key: string, field: "weekday" | "start_time" | "end_time", value: string) {
    setBlocks((current) => current.map((block) => block.key === key ? { ...block, saved: false, [field]: field === "weekday" ? Number(value) : value } : block));
    changed();
  }

  async function save() {
    const result = await action(blocks.map(({ weekday,start_time,end_time }) => ({ weekday,start_time,end_time })));
    if (result.ok) {
      setBlocks((current) => current.map((block) => ({ ...block, saved: true })));
      setDirty(false);
      setPresetBackup(null);
      setSavedComplete(true);
    }
    return result;
  }

  function applyPreset(preset: (typeof presets)[number]) {
    setPresetBackup((current) => current ?? { blocks: blocks.map((block) => ({ ...block })), dirty });
    setBlocks(preset.days.map((weekday) => ({ key: crypto.randomUUID(), weekday, start_time: preset.start, end_time: preset.end, saved: false })));
    changed();
  }

  function addCustomBlock() {
    setBlocks((current) => [...current, { key: crypto.randomUUID(), weekday: 1, start_time: "09:00", end_time: "12:00", saved: false }]);
    setShowExactTimes(true);
    changed();
  }

  function beginDrag(event: ReactPointerEvent<HTMLElement>, block: EditorBlock, mode: "move" | "resize") {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { key: block.key, mode, y: event.clientY, start: minuteValue(block.start_time), end: minuteValue(block.end_time) };
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const active = drag.current;
    if (!active || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const delta = Math.round(((event.clientY - active.y) / calendarHeight * calendarMinutes) / snapMinutes) * snapMinutes;
    setBlocks((current) => current.map((block) => {
      if (block.key !== active.key) return block;
      if (active.mode === "resize") {
        const end = Math.max(active.start + snapMinutes, Math.min(calendarEnd, active.end + delta));
        return { ...block, end_time: timeValue(end), saved: false };
      }
      const duration = active.end - active.start;
      const start = Math.max(calendarStart, Math.min(calendarEnd - duration, active.start + delta));
      return { ...block, start_time: timeValue(start), end_time: timeValue(start + duration), saved: false };
    }));
    setDirty(true);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!drag.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
    setRevision((current) => current + 1);
  }

  if (savedComplete) return <div className="rounded-card bg-brand/10 px-5 py-7 text-center">
    <p className="font-display text-2xl text-ink">Teaching hours saved</p>
    {!compactSetup ? <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Find an Opening can now use these normal hours. Existing lessons stayed exactly where they were, and exceptions remain available.</p> : null}
    <button type="button" onClick={() => setSavedComplete(false)} className="mt-5 rounded-control border border-brand px-4 py-2 text-sm text-brand transition hover:bg-brand hover:text-canvas">Edit weekly availability</button>
  </div>;

  return (
    <div>
      <div className="mb-5 rounded-control bg-surface p-4">
        <p className="text-sm font-medium text-ink">Start with a common schedule</p>
        {!compactSetup ? <p className="mt-1 text-xs leading-5 text-muted">These hours power Find an Opening. They describe the normal week, not a hard rule—you can still schedule an exception.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => <button key={preset.label} type="button" onClick={() => applyPreset(preset)} className="rounded-control border border-line bg-canvas px-3 py-2 text-xs text-muted transition hover:border-brand hover:text-brand">{preset.label}</button>)}
          <button type="button" onClick={addCustomBlock} className="rounded-control border border-brand/60 bg-transparent px-3 py-2 text-xs text-brand transition hover:bg-brand hover:text-canvas">Custom time</button>
          {presetBackup ? <button type="button" onClick={() => { setBlocks(presetBackup.blocks); setDirty(presetBackup.dirty); setPresetBackup(null); setRevision((current) => current + 1); }} className="px-2 py-2 text-xs text-brand underline underline-offset-4">Undo preset</button> : null}
        </div>
      </div>
      {compactSetup ? <div className="overflow-x-auto rounded-control bg-canvas/65 p-3">
        <div className="grid min-w-[46rem] grid-cols-[3.25rem_repeat(7,minmax(5rem,1fr))]">
          <div />
          {calendarDays.map((weekday) => <div key={weekday} className="pb-2 text-center text-[0.68rem] font-medium uppercase tracking-[0.1em] text-muted">{days[weekday].slice(0,3)}</div>)}
          <div className="relative" style={{ height: calendarHeight }}>{Array.from({ length: 9 }, (_, index) => { const minute = calendarStart + index * 120; return <span key={minute} className="absolute right-2 -translate-y-1/2 text-[0.6rem] text-muted" style={{ top: `${(minute - calendarStart) / calendarMinutes * 100}%` }}>{shortTime(timeValue(minute))}</span>; })}</div>
          {calendarDays.map((weekday) => <div key={weekday} className="relative border-l border-line/70 bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_27px,var(--ui-line)_28px)]" style={{ height: calendarHeight }}>
            {blocks.filter((block) => block.weekday === weekday && minuteValue(block.end_time) > calendarStart && minuteValue(block.start_time) < calendarEnd).map((block) => {
              const start = Math.max(calendarStart, minuteValue(block.start_time));
              const end = Math.min(calendarEnd, minuteValue(block.end_time));
              return <div key={block.key} role="group" aria-label={`${days[weekday]} ${shortTime(block.start_time)} to ${shortTime(block.end_time)}`} onPointerDown={(event) => beginDrag(event, block, "move")} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className="absolute inset-x-1 touch-none cursor-grab rounded-control border border-brand/60 bg-brand/25 px-1.5 py-1 text-[0.62rem] text-ink shadow-sm active:cursor-grabbing" style={{ top: `${(start - calendarStart) / calendarMinutes * 100}%`, height: `${Math.max(18, (end - start) / calendarMinutes * calendarHeight)}px` }}>
                <button type="button" aria-label={`Delete ${days[weekday]} block`} title="Delete time block" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setBlocks((current) => current.filter((item) => item.key !== block.key)); changed(); }} className="absolute right-1 top-1 z-10 grid h-6 w-6 place-items-center rounded-full bg-canvas/90 text-sm text-danger shadow-sm transition hover:scale-110 hover:bg-canvas"><MdDeleteOutline aria-hidden="true" /></button>
                <span className="block pr-3 font-medium">{shortTime(block.start_time)}</span><span className="block opacity-70">{shortTime(block.end_time)}</span>
                <span role="presentation" onPointerDown={(event) => beginDrag(event, block, "resize")} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className="absolute inset-x-1 bottom-0 h-3 cursor-ns-resize touch-none border-t border-brand/40" />
              </div>;
            })}
          </div>)}
        </div>
        <p className="mt-3 text-center text-xs text-muted">Drag a block to move it. Drag its bottom edge to change its length.</p>
      </div> : null}
      {showExactTimes ? <div className="mt-5 space-y-3">
        {compactSetup ? <div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Exact times</p><button type="button" onClick={() => setShowExactTimes(false)} className="text-xs text-brand">Hide</button></div> : null}
        {dirty ? <p className="text-xs font-medium text-brand">Changes not saved yet</p> : null}
        {blocks.length ? blocks.map((block) => (
          <div key={block.key} className={block.saved ? "rounded-control bg-brand/10 p-3" : "rounded-control border border-brand/60 bg-transparent p-3"}>
            <div className="flex min-h-7 items-start justify-between gap-3">
              <span className={`text-xs font-medium ${block.saved ? "invisible" : "text-brand"}`}>Not saved yet</span>
              <button type="button" aria-label={`Remove ${days[block.weekday]} availability block`} title="Remove this block" onClick={() => { setBlocks((current) => current.filter((item) => item.key !== block.key)); changed(); }} className="grid h-7 w-7 place-items-center text-xl leading-none text-danger">×</button>
            </div>
            <div className="mt-1 grid gap-3 sm:grid-cols-[1fr_8rem_8rem] sm:items-end">
              <label><span className="text-xs text-muted">Day</span><AppSelect value={block.weekday} onChange={(event) => update(block.key,"weekday",event.target.value)} className="mt-2 w-full rounded-control border border-line bg-surface px-3 py-2">{days.map((day,index) => <option key={day} value={index}>{day}</option>)}</AppSelect></label>
              <label><span className="text-xs text-muted">Starts</span><input type="time" value={block.start_time} onChange={(event) => update(block.key,"start_time",event.target.value)} className="mt-2 w-full rounded-control border border-line bg-surface px-3 py-2" /></label>
              <label><span className="text-xs text-muted">Ends</span><input type="time" value={block.end_time} onChange={(event) => update(block.key,"end_time",event.target.value)} className="mt-2 w-full rounded-control border border-line bg-surface px-3 py-2" /></label>
            </div>
          </div>
        )) : <p className="rounded-control bg-surface p-4 text-sm text-muted">No working hours added yet.</p>}
      </div> : blocks.length === 0 ? <p className="mt-4 text-center text-sm text-muted">Choose a schedule above or add a custom time.</p> : <button type="button" onClick={() => setShowExactTimes(true)} className="mt-4 text-sm text-brand underline underline-offset-4">Edit exact times</button>}
      {!compactSetup ? <button type="button" onClick={addCustomBlock} className="mt-4 rounded-control border border-brand/60 bg-surface px-4 py-2 text-sm text-brand transition hover:-translate-y-px hover:border-brand">Add a time block +</button> : null}
      <div className="mt-6 max-w-md"><HoldToConfirm key={revision} action={save} disabled={!dirty} disabledMessage={compactSetup ? "No changes to save." : "Add, edit, or remove a block to change this schedule."} idleLabel="Hold to save teaching hours" holdingLabel="Keep holding to replace the schedule…" submittingLabel="Saving teaching hours…" successLabel="Teaching hours saved" refreshOnSuccess /></div>
      {compactSetup ? <details className="mt-3 text-xs text-muted"><summary className="cursor-pointer text-brand">More about teaching hours</summary><p className="mt-2 leading-5">Saving replaces the normal weekly hours from today forward. Existing lessons do not move, and you can still schedule outside these hours when needed.</p></details> : <p className="mt-3 text-xs leading-5 text-muted">Saving replaces the normal recurring schedule from today forward. It never moves existing lessons and does not prevent an owner from making an exception.</p>}
    </div>
  );
}
