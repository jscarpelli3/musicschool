import { SCHOOL_FONTS, type SchoolFontKey } from "@/lib/ui/school-fonts";

export function FontSelector({ currentFont, action }: { currentFont: SchoolFontKey; action: (formData: FormData) => Promise<void> }) {
  return <form action={action} className="py-10 md:pl-10">
    <fieldset>
      <legend className="sr-only">School typography</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {SCHOOL_FONTS.map((font) => <label key={font.key} data-school-font={font.key} className="cursor-pointer">
          <input type="radio" name="font_key" value={font.key} defaultChecked={font.key === currentFont} className="peer sr-only" />
          <span className="block min-h-48 border border-line bg-canvas p-5 text-ink transition hover:-translate-y-px hover:bg-surface peer-checked:border-brand peer-checked:bg-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand">
            <span className="font-display text-3xl leading-none" aria-hidden="true">{font.sample}</span>
            <span className="mt-6 flex items-baseline justify-between gap-3"><strong className="text-sm font-medium">{font.name}</strong>{font.key === currentFont ? <span className="text-xs text-brand">Current</span> : null}</span>
            <span className="mt-2 block text-xs leading-5 text-muted">{font.description}</span>
          </span>
        </label>)}
      </div>
    </fieldset>
    <button type="submit" className="mt-6 border border-brand bg-transparent px-5 py-3 text-sm text-brand transition hover:-translate-y-px hover:bg-brand hover:text-canvas">Save typography</button>
  </form>;
}
