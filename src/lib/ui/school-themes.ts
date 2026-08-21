export const SCHOOL_THEMES = [
  { key: "midnight", name: "Midnight", description: "Deep navy with electric cyan." },
  { key: "conservatory", name: "Conservatory", description: "Evergreen with a clear mint accent." },
  { key: "paper", name: "Paper", description: "Warm ivory with crisp blue-black type." },
  { key: "ember", name: "Ember", description: "Burnt umber with a warm orange accent." },
  { key: "monochrome", name: "Monochrome", description: "True black, white, and neutral gray." },
  { key: "orchid", name: "Orchid", description: "Saturated violet with a luminous lavender accent." },
  { key: "tidepool", name: "Tidepool", description: "Dark teal with a bright aquatic accent." },
  { key: "lemonade", name: "Lemonade", description: "Sunny yellow with a playful violet accent." },
  { key: "bubblegum", name: "Bubblegum", description: "Bright pink with a rich berry accent." },
] as const;

export type SchoolThemeKey = (typeof SCHOOL_THEMES)[number]["key"];

export function isSchoolThemeKey(value: string): value is SchoolThemeKey {
  return SCHOOL_THEMES.some((theme) => theme.key === value);
}
