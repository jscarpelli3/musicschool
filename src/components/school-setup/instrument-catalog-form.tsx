import { COMMON_INSTRUMENTS } from "@/lib/schools/instruments";

export function InstrumentCatalogForm({
  instruments,
  action,
}: {
  instruments: string[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const common = new Set(COMMON_INSTRUMENTS.map((name) => name.toLocaleLowerCase()));
  const selected = new Set(instruments.map((name) => name.toLocaleLowerCase()));
  const custom = instruments.filter((name) => !common.has(name.toLocaleLowerCase()));

  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="text-sm font-medium text-ink">Instruments taught</legend>
        <p className="mt-1 text-sm leading-6 text-muted">These choices become the instrument list used throughout your school.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {COMMON_INSTRUMENTS.map((instrument) => (
            <label key={instrument} className="flex items-center gap-3 border border-line px-3 py-2 text-sm">
              <input type="checkbox" name="instrument" value={instrument} defaultChecked={selected.has(instrument.toLocaleLowerCase())} className="accent-brand" />
              {instrument}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm font-medium text-ink">Other instruments</span>
        <span className="mt-1 block text-xs text-muted">Enter one per line. These are stored as your school’s own instrument names.</span>
        <textarea name="other_instruments" rows={Math.max(3, custom.length)} defaultValue={custom.join("\n")} placeholder={"Mandolin\nMusic production"} className="mt-3 w-full border border-line bg-transparent p-3 text-sm outline-none focus:border-brand" />
      </label>
      <button className="border border-brand px-5 py-3 text-sm text-brand">Save instruments</button>
    </form>
  );
}
