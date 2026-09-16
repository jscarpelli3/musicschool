export const SCHOOL_THEMES = [
  { key: "midnight", name: "Midnight", description: "Deep navy with electric cyan." },
  { key: "conservatory", name: "Conservatory", description: "Evergreen with a clear mint accent." },
  { key: "paper", name: "Paper", description: "Warm ivory with crisp blue-black type." },
  { key: "ember", name: "Ember", description: "Burnt umber with a warm orange accent." },
  { key: "monochrome", name: "Monochrome", description: "True black, white, and neutral gray." },
  { key: "orchid", name: "Orchid", description: "Saturated violet with a luminous lavender accent." },
  { key: "tidepool", name: "Tidepool", description: "Dark teal with a bright aquatic accent." },
  { key: "lemonade", name: "Lemonade", description: "Sunny yellow with a playful violet accent." },
  { key: "berries", name: "Berries", description: "Bright pink with a rich berry accent." },
  { key: "gumballs", name: "Gumballs", description: "Candy yellow, blue, and cherry red." },
  { key: "cobalt", name: "Cobalt", description: "Inky blue with a cool periwinkle accent." },
  { key: "clay", name: "Clay", description: "Soft terracotta, warm cream, and brick red." },
  { key: "sage", name: "Sage", description: "Quiet botanical greens on a pale mineral base." },
  { key: "cabaret", name: "Cabaret", description: "Dark wine with a vivid rose accent." },
  { key: "glacier", name: "Glacier", description: "Icy blue with a crisp deep-water accent." },
  { key: "espresso", name: "Espresso", description: "Roasted brown with cream and fresh teal." },
] as const;

export const SCHOOL_THEME_ICON = "/app-icons/common-time-192.png";

export type SchoolThemeKey = (typeof SCHOOL_THEMES)[number]["key"];

export function isSchoolThemeKey(value: string): value is SchoolThemeKey {
  return SCHOOL_THEMES.some((theme) => theme.key === value);
}
