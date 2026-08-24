"use client";

import { useState } from "react";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

export type WeeklyAvailabilityBlock = { weekday: number; start_time: string; end_time: string };
type Result = { ok: boolean; message: string };
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function WeeklyAvailabilityEditor({ initialBlocks, action }: { initialBlocks: WeeklyAvailabilityBlock[]; action: (blocks: WeeklyAvailabilityBlock[]) => Promise<Result> }) {
  const [blocks, setBlocks] = useState(() => initialBlocks.map((block, index) => ({ ...block, key: `${block.weekday}-${block.start_time}-${index}` })));

  function update(key: string, field: "weekday" | "start_time" | "end_time", value: string) {
    setBlocks((current) => current.map((block) => block.key === key ? { ...block, [field]: field === "weekday" ? Number(value) : value } : block));
  }

  return (
    <div>
      <div className="space-y-3">
        {blocks.length ? blocks.map((block) => (
          <div key={block.key} className="grid gap-3 border border-line p-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
            <label><span className="text-xs text-muted">Day</span><select value={block.weekday} onChange={(event) => update(block.key,"weekday",event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-2">{days.map((day,index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <label><span className="text-xs text-muted">Starts</span><input type="time" value={block.start_time} onChange={(event) => update(block.key,"start_time",event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-2" /></label>
            <label><span className="text-xs text-muted">Ends</span><input type="time" value={block.end_time} onChange={(event) => update(block.key,"end_time",event.target.value)} className="mt-2 w-full border-b border-line bg-transparent py-2" /></label>
            <button type="button" onClick={() => setBlocks((current) => current.filter((item) => item.key !== block.key))} className="px-2 py-2 text-sm text-danger">Remove</button>
          </div>
        )) : <p className="border border-line p-4 text-sm text-muted">No weekly availability is recorded. Lessons may still exist, but new placements will be flagged as outside availability.</p>}
      </div>
      <button type="button" onClick={() => setBlocks((current) => [...current,{ key: crypto.randomUUID(), weekday: 1, start_time: "09:00", end_time: "12:00" }])} className="mt-4 border-b border-brand pb-1 text-sm text-brand">Add a time block +</button>
      <div className="mt-6 max-w-md"><HoldToConfirm action={() => action(blocks.map(({ weekday,start_time,end_time }) => ({ weekday,start_time,end_time })))} idleLabel="Hold to save weekly availability" holdingLabel="Keep holding to replace the schedule…" submittingLabel="Saving weekly availability…" successLabel="Availability saved" refreshOnSuccess /></div>
      <p className="mt-3 text-xs leading-5 text-muted">Saving replaces the recurring schedule from today forward. It never moves existing lessons automatically.</p>
    </div>
  );
}
