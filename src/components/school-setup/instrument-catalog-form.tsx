"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MdAutorenew } from "react-icons/md";
import { COMMON_INSTRUMENTS } from "@/lib/schools/instruments";
import type { InstrumentCatalogResult } from "@/app/schools/[schoolId]/setup/instrument-actions";

export function InstrumentCatalogForm({
  instruments,
  action,
}: {
  instruments: string[];
  action: (formData: FormData) => Promise<InstrumentCatalogResult>;
}) {
  const router = useRouter();
  const [result, setResult] = useState<InstrumentCatalogResult | null>(null);
  const common = new Set(COMMON_INSTRUMENTS.map((name) => name.toLocaleLowerCase()));
  const [selected, setSelected] = useState(() => new Set(instruments.filter((name) => common.has(name.toLocaleLowerCase())).map((name) => name.toLocaleLowerCase())));
  const [custom, setCustom] = useState(() => instruments.filter((name) => !common.has(name.toLocaleLowerCase())).join("\n"));
  const [saving, setSaving] = useState<Record<string, number>>({});
  const saveQueue = useRef(Promise.resolve());
  const lastSavedCustom = useRef(custom);

  function save(nextSelected: Set<string>, nextCustom: string, key: string) {
    setSaving((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }));
    setResult(null);
    const formData = new FormData();
    COMMON_INSTRUMENTS.forEach((instrument) => {
      if (nextSelected.has(instrument.toLocaleLowerCase())) formData.append("instrument", instrument);
    });
    formData.set("other_instruments", nextCustom);
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const nextResult = await action(formData);
        setResult(nextResult);
        if (nextResult.ok) {
          if (key === "custom") lastSavedCustom.current = nextCustom;
          router.refresh();
        }
      } catch {
        setResult({ ok: false, message: "The instrument list could not be saved." });
      } finally {
        setSaving((current) => {
          const count = (current[key] ?? 1) - 1;
          const next = { ...current };
          if (count > 0) next[key] = count;
          else delete next[key];
          return next;
        });
      }
    });
  }

  function toggle(instrument: string, checked: boolean) {
    const next = new Set(selected);
    const key = instrument.toLocaleLowerCase();
    if (checked) next.add(key);
    else next.delete(key);
    setSelected(next);
    save(next, custom, instrument);
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-medium text-ink">Instruments taught</legend>
        <p className="mt-1 text-sm leading-6 text-muted">These choices become the instrument list used throughout your school.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {COMMON_INSTRUMENTS.map((instrument) => (
            <label key={instrument} className="flex items-center gap-3 border border-line px-3 py-2 text-sm transition hover:bg-canvas/50" aria-busy={Boolean(saving[instrument])}>
              <input type="checkbox" checked={selected.has(instrument.toLocaleLowerCase())} onChange={(event) => toggle(instrument, event.currentTarget.checked)} className="accent-brand" />
              <span className="flex-1">{instrument}</span>
              {saving[instrument] ? <MdAutorenew aria-label={`Saving ${instrument}`} className="h-4 w-4 animate-spin text-brand" /> : null}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm font-medium text-ink">Other instruments</span>
        <span className="mt-1 block text-xs text-muted">Enter one per line. These are stored as your school’s own instrument names.</span>
        <textarea rows={Math.max(3, custom.split("\n").length)} value={custom} onChange={(event) => setCustom(event.currentTarget.value)} onBlur={() => { if (custom !== lastSavedCustom.current) save(selected, custom, "custom"); }} placeholder={"Mandolin\nMusic production"} className="mt-3 w-full border border-line bg-transparent p-3 text-sm outline-none focus:border-brand" />
        {saving.custom ? <span className="mt-2 flex items-center gap-2 text-xs text-muted"><MdAutorenew aria-hidden="true" className="h-4 w-4 animate-spin text-brand" />Saving other instruments…</span> : null}
      </label>
      {result && !result.ok ? <p role="alert" className="text-sm text-danger">{result.message}</p> : null}
    </div>
  );
}
