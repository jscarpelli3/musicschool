export function TeacherInstrumentFields({ instruments }: { instruments: string[] }) {
  return (
    <fieldset className="md:col-span-2">
      <legend className="text-xs text-muted">Instruments taught</legend>
      {instruments.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {instruments.map((instrument) => (
            <label key={instrument} className="flex items-center gap-3 border border-line px-3 py-2 text-sm">
              <input type="checkbox" name="instrument" value={instrument} className="accent-brand" />
              {instrument}
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-2 border border-warning/40 bg-warning/10 p-3 text-sm text-warning">Choose the instruments your school teaches before adding a teacher.</p>
      )}
    </fieldset>
  );
}
