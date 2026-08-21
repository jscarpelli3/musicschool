export const SCHOOL_THEMES = [
  { key: "midnight", name: "Midnight", description: "Deep navy with electric cyan." },
  { key: "conservatory", name: "Conservatory", description: "Evergreen with a clear mint accent." },
  { key: "aubergine", name: "Aubergine", description: "Black plum with a bright violet accent." },
  { key: "ember", name: "Ember", description: "Burnt umber with a warm orange accent." },
  { key: "monochrome", name: "Monochrome", description: "Cool graphite with a restrained silver accent." },
] as const;

export type SchoolThemeKey = (typeof SCHOOL_THEMES)[number]["key"];

export function isSchoolThemeKey(value: string): value is SchoolThemeKey {
  return SCHOOL_THEMES.some((theme) => theme.key === value);
}
