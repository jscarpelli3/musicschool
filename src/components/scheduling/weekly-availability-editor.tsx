"use client";

import { useState } from "react";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

export type WeeklyAvailabilityBlock = { weekday: number; start_time: string; end_time: string };
type Result = { ok: boolean; message: string };
type EditorBlock = WeeklyAvailabilityBlock & { key: string; saved: boolean };
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function WeeklyAvailabilityEditor({ initialBlocks, action }: { initialBlocks: WeeklyAvailabilityBlock[]; action: (blocks: WeeklyAvailabilityBlock[]) => Promise<Result> }) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => initialBlocks.map((block, index) => ({ ...block, key: `${block.weekday}-${block.start_time}-${index}`, saved: true })));
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);

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
    }
    return result;
  }

  return (
    <div>
      <div className="space-y-3">
        {dirty ? <p className="text-xs font-medium text-brand">Changes not saved yet</p> : null}
        {blocks.length ? blocks.map((block) => (
          <div key={block.key} className="border border-line p-3">
            <div className="flex min-h-7 items-start justify-between gap-3">
              <span className={`text-xs font-medium ${block.saved ? "invisible" : "text-brand"}`}>Not saved yet</span>
              <button type="button" aria-label={`Remove ${days[block.weekday]} availability block`} title="Remove this block" onClick={() => { setBlocks((current) => current.filter((item) => item.key !== block.key)); changed(); }} className="grid h-7 w-7 place-items-center text-xl leading-none text-danger">×</button>
            </div>
            <div className="mt-1 grid gap-3 sm:grid-cols-[1fr_8rem_8rem] sm:items-end">
              <label><span className="text-xs text-muted">Day</span><select value={block.weekday} onChange={(event) => update(block.key,"weekday",event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-2">{days.map((day,index) => <option key={day} value={index}>{day}</option>)}</select></label>
              <label><span className="text-xs text-muted">Starts</span><input type="time" value={block.start_time} onChange={(event) => update(block.key,"start_time",event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-2" /></label>
              <label><span className="text-xs text-muted">Ends</span><input type="time" value={block.end_time} onChange={(event) => update(block.key,"end_time",event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-2" /></label>
            </div>
          </div>
        )) : <p className="border border-line p-4 text-sm text-muted">No weekly availability is recorded. Lessons may still exist, but new placements will be flagged as outside availability.</p>}
      </div>
      <button type="button" onClick={() => { setBlocks((current) => [...current,{ key: crypto.randomUUID(), weekday: 1, start_time: "09:00", end_time: "12:00", saved: false }]); changed(); }} className="mt-4 border-b border-brand pb-1 text-sm text-brand">Add a time block +</button>
      <div className="mt-6 max-w-md"><HoldToConfirm key={revision} action={save} disabled={!dirty} disabledMessage="Add, edit, or remove a block to change this schedule." idleLabel="Hold to save weekly availability" holdingLabel="Keep holding to replace the schedule…" submittingLabel="Saving weekly availability…" successLabel="Availability saved" refreshOnSuccess /></div>
      <p className="mt-3 text-xs leading-5 text-muted">Saving replaces the recurring schedule from today forward. It never moves existing lessons automatically.</p>
    </div>
  );
}
