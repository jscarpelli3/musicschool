import { SCHOOL_THEMES, type SchoolThemeKey } from "@/lib/ui/school-themes";

export function ThemeSelector({
  currentTheme,
  action,
}: {
  currentTheme: SchoolThemeKey;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="py-10 md:pl-10">
      <fieldset>
        <legend className="sr-only">School interface palette</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {SCHOOL_THEMES.map((theme) => (
            <label key={theme.key} data-school-theme={theme.key} className="cursor-pointer">
              <input
                type="radio"
                name="theme_key"
                value={theme.key}
                defaultChecked={theme.key === currentTheme}
                className="peer sr-only"
              />
              <span className="block border border-line bg-canvas p-4 text-ink transition peer-checked:border-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="h-5 flex-1 bg-surface" />
                  <span className="h-5 flex-1 bg-surface-raised" />
                  <span className="h-5 flex-1 bg-brand" />
                  <span className="h-5 flex-1 bg-ink" />
                </span>
                <span className="mt-4 flex items-baseline justify-between gap-3">
                  <strong className="text-sm font-medium">{theme.name}</strong>
                  {theme.key === currentTheme ? <span className="text-xs text-brand">Current</span> : null}
                </span>
                <span className="mt-2 block text-xs leading-5 text-muted">{theme.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="submit"
        className="mt-6 border border-brand px-5 py-3 text-sm text-brand transition hover:bg-brand hover:text-canvas"
      >
        Save palette
      </button>
    </form>
  );
}
