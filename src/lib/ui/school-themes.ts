export const SCHOOL_THEMES = [
  { key: "midnight", name: "Midnight", description: "Deep navy with electric cyan." },
  { key: "conservatory", name: "Conservatory", description: "Evergreen with a clear mint accent." },
  { key: "paper", name: "Paper", description: "Warm ivory with crisp blue-black type." },
  { key: "ember", name: "Ember", description: "Burnt umber with a warm orange accent." },
  { key: "monochrome", name: "Monochrome", description: "Cool graphite with a restrained silver accent." },
  { key: "rosewood", name: "Rosewood", description: "Deep red wood with a soft coral accent." },
  { key: "tidepool", name: "Tidepool", description: "Dark teal with a bright aquatic accent." },
] as const;

export type SchoolThemeKey = (typeof SCHOOL_THEMES)[number]["key"];

export function isSchoolThemeKey(value: string): value is SchoolThemeKey {
  return SCHOOL_THEMES.some((theme) => theme.key === value);
}
