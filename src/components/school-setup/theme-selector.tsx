"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { SCHOOL_THEMES, type SchoolThemeKey } from "@/lib/ui/school-themes";
import { ChoiceConfirmationDialog } from "./choice-confirmation-dialog";

export function ThemeSelector({
  currentTheme,
  action,
}: {
  currentTheme: SchoolThemeKey;
  action: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<SchoolThemeKey>(currentTheme);
  const [pending, setPending] = useState<SchoolThemeKey | null>(null);
  const cancelChange = useCallback(() => {
    setSelected(currentTheme);
    setPending(null);
  }, [currentTheme]);
  const pendingTheme = SCHOOL_THEMES.find((theme) => theme.key === pending);

  return (
    <form action={action}>
      <fieldset>
        <legend className="sr-only">School interface palette</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {SCHOOL_THEMES.map((theme) => (
            <label key={theme.key} data-school-theme={theme.key} className="cursor-pointer">
              <input
                type="radio"
                name="theme_key"
                value={theme.key}
                checked={theme.key === selected}
                onChange={() => {
                  if (theme.key === currentTheme) return;
                  setSelected(theme.key);
                  setPending(theme.key);
                }}
                className="peer sr-only"
              />
              <span className="block rounded-md border border-line bg-canvas p-4 text-ink transition peer-checked:border-brand peer-checked:bg-brand/10 peer-checked:shadow-[inset_0_0_0_1px_var(--ui-brand)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand">
                <span className="flex items-center gap-4" aria-hidden="true">
                  <Image src={theme.icon} alt="" width={52} height={52} className="h-13 w-13 shrink-0" />
                  <span className="flex flex-1 gap-1">
                    <span className="h-5 flex-1 bg-surface" />
                    <span className="h-5 flex-1 bg-surface-raised" />
                    <span className="h-5 flex-1 bg-brand" />
                    <span className="h-5 flex-1 bg-ink" />
                  </span>
                </span>
                <span className="mt-4 flex items-baseline justify-between gap-3">
                  <strong className="text-sm font-medium">{theme.name}</strong>
                  {theme.key === selected ? <span className="text-xs font-medium text-brand">✓ {theme.key === currentTheme ? "Current" : "Selected"}</span> : null}
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted">{theme.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <ChoiceConfirmationDialog open={pending !== null} title="Change the school palette?" description={`This will update colors across the school workspace${pendingTheme ? ` to ${pendingTheme.name}` : ""}.`} confirmLabel="Change palette" onCancel={cancelChange} />
    </form>
  );
}
