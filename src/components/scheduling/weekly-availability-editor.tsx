"use client";

import { useState } from "react";
import { AppSelect } from "@/components/ui/app-select";
import { HoldToConfirm } from "@/components/ui/hold-to-confirm";

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

export function WeeklyAvailabilityEditor({ initialBlocks, action, compactSetup = false }: { initialBlocks: WeeklyAvailabilityBlock[]; action: (blocks: WeeklyAvailabilityBlock[]) => Promise<Result>; compactSetup?: boolean }) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() => initialBlocks.map((block, index) => ({ ...block, key: `${block.weekday}-${block.start_time}-${index}`, saved: true })));
  const [dirty, setDirty] = useState(false);
  const [revision, setRevision] = useState(0);
  const [presetBackup, setPresetBackup] = useState<{ blocks: EditorBlock[]; dirty: boolean } | null>(null);
  const [savedComplete, setSavedComplete] = useState(false);

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

  if (savedComplete) return <div className="rounded-card bg-brand/10 px-5 py-7 text-center">
    <p className="font-display text-2xl text-ink">Teaching hours saved</p>
    {!compactSetup ? <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Find an Opening can now use these normal hours. Existing lessons stayed exactly where they were, and exceptions remain available.</p> : null}
    <button type="button" onClick={() => setSavedComplete(false)} className="mt-5 rounded-control border border-brand px-4 py-2 text-sm text-brand transition hover:bg-brand hover:text-canvas">Edit weekly availability</button>
  </div>;

  return (
    <div>
      <div className="mb-5 rounded-control bg-surface p-4">
        <p className="text-sm font-medium text-ink">Suggested weekly blocks</p>
        {!compactSetup ? <p className="mt-1 text-xs leading-5 text-muted">These hours power Find an Opening. They describe the normal week, not a hard rule—you can still schedule an exception.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {presets.map((preset) => <button key={preset.label} type="button" onClick={() => applyPreset(preset)} className="rounded-control border border-line bg-canvas px-3 py-2 text-xs text-muted transition hover:border-brand hover:text-brand">Replace draft with {preset.label.toLowerCase()}</button>)}
          {presetBackup ? <button type="button" onClick={() => { setBlocks(presetBackup.blocks); setDirty(presetBackup.dirty); setPresetBackup(null); setRevision((current) => current + 1); }} className="px-2 py-2 text-xs text-brand underline underline-offset-4">Undo preset</button> : null}
        </div>
      </div>
      <div className="mb-3 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="text-xs uppercase tracking-[0.12em] text-muted">Or set specific hours</span><span className="h-px flex-1 bg-line" /></div>
      <div className="space-y-3">
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
      </div>
      <button type="button" onClick={() => { setBlocks((current) => [...current,{ key: crypto.randomUUID(), weekday: 1, start_time: "09:00", end_time: "12:00", saved: false }]); changed(); }} className="mt-4 rounded-control border border-brand/60 bg-surface px-4 py-2 text-sm text-brand transition hover:-translate-y-px hover:border-brand">Add a time block +</button>
      <div className="mt-6 max-w-md"><HoldToConfirm key={revision} action={save} disabled={!dirty} disabledMessage={compactSetup ? "No changes to save." : "Add, edit, or remove a block to change this schedule."} idleLabel="Hold to save teaching hours" holdingLabel="Keep holding to replace the schedule…" submittingLabel="Saving teaching hours…" successLabel="Teaching hours saved" refreshOnSuccess /></div>
      {compactSetup ? <details className="mt-3 text-xs text-muted"><summary className="cursor-pointer text-brand">More about teaching hours</summary><p className="mt-2 leading-5">Saving replaces the normal weekly hours from today forward. Existing lessons do not move, and you can still schedule outside these hours when needed.</p></details> : <p className="mt-3 text-xs leading-5 text-muted">Saving replaces the normal recurring schedule from today forward. It never moves existing lessons and does not prevent an owner from making an exception.</p>}
    </div>
  );
}
