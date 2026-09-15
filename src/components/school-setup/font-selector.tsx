"use client";

import { useCallback, useState } from "react";
import { SCHOOL_FONTS, type SchoolFontKey } from "@/lib/ui/school-fonts";
import { ChoiceConfirmationDialog } from "./choice-confirmation-dialog";

export function FontSelector({ currentFont, action }: { currentFont: SchoolFontKey; action: (formData: FormData) => Promise<void> }) {
  const [selected, setSelected] = useState<SchoolFontKey>(currentFont);
  const [pending, setPending] = useState<SchoolFontKey | null>(null);
  const cancelChange = useCallback(() => {
    setSelected(currentFont);
    setPending(null);
  }, [currentFont]);
  const pendingFont = SCHOOL_FONTS.find((font) => font.key === pending);

  return <form action={action}>
    <fieldset>
      <legend className="sr-only">School typography</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {SCHOOL_FONTS.map((font) => <label key={font.key} data-school-font={font.key} className="cursor-pointer">
          <input type="radio" name="font_key" value={font.key} checked={font.key === selected} onChange={() => { if (font.key === currentFont) return; setSelected(font.key); setPending(font.key); }} className="peer sr-only" />
          <span className="block min-h-48 rounded-md border border-line bg-canvas p-5 text-ink transition hover:-translate-y-px hover:bg-surface peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:shadow-[inset_0_0_0_1px_var(--ui-brand)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand">
            <span className="font-display text-3xl leading-none" aria-hidden="true">{font.sample}</span>
            <span className="mt-6 flex items-baseline justify-between gap-3"><strong className="text-sm font-medium">{font.name}</strong>{font.key === selected ? <span className="text-xs font-medium text-brand">✓ {font.key === currentFont ? "Current" : "Selected"}</span> : null}</span>
            <span className="mt-2 block text-xs leading-5 text-muted">{font.description}</span>
          </span>
        </label>)}
      </div>
    </fieldset>
    <ChoiceConfirmationDialog open={pending !== null} title="Change the school fonts?" description={`This will update headings and interface text across the school workspace${pendingFont ? ` to ${pendingFont.name}` : ""}.`} confirmLabel="Change fonts" onCancel={cancelChange} />
  </form>;
}
