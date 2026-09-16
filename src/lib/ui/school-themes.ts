export const SCHOOL_THEMES = [
  { key: "midnight", name: "Midnight", description: "Deep navy with electric cyan.", icon: "/app-icons/midnight.png" },
  { key: "conservatory", name: "Conservatory", description: "Evergreen with a clear mint accent.", icon: "/app-icons/conservatory.png" },
  { key: "paper", name: "Paper", description: "Warm ivory with crisp blue-black type.", icon: "/app-icons/paper.png" },
  { key: "ember", name: "Ember", description: "Burnt umber with a warm orange accent.", icon: "/app-icons/ember.png" },
  { key: "monochrome", name: "Monochrome", description: "True black, white, and neutral gray.", icon: "/app-icons/monochrome.png" },
  { key: "orchid", name: "Orchid", description: "Saturated violet with a luminous lavender accent.", icon: "/app-icons/orchid.png" },
  { key: "tidepool", name: "Tidepool", description: "Dark teal with a bright aquatic accent.", icon: "/app-icons/tidepool.png" },
  { key: "lemonade", name: "Lemonade", description: "Sunny yellow with a playful violet accent.", icon: "/app-icons/lemonade.png" },
  { key: "berries", name: "Berries", description: "Bright pink with a rich berry accent.", icon: "/app-icons/berries.png" },
  { key: "gumballs", name: "Gumballs", description: "Candy yellow, blue, and cherry red.", icon: "/app-icons/gumballs.png" },
  { key: "cobalt", name: "Cobalt", description: "Inky blue with a cool periwinkle accent.", icon: "/app-icons/cobalt.svg" },
  { key: "clay", name: "Clay", description: "Soft terracotta, warm cream, and brick red.", icon: "/app-icons/clay.svg" },
  { key: "sage", name: "Sage", description: "Quiet botanical greens on a pale mineral base.", icon: "/app-icons/sage.svg" },
  { key: "cabaret", name: "Cabaret", description: "Dark wine with a vivid rose accent.", icon: "/app-icons/cabaret.svg" },
  { key: "glacier", name: "Glacier", description: "Icy blue with a crisp deep-water accent.", icon: "/app-icons/glacier.svg" },
  { key: "espresso", name: "Espresso", description: "Roasted brown with cream and fresh teal.", icon: "/app-icons/espresso.svg" },
] as const;

export type SchoolThemeKey = (typeof SCHOOL_THEMES)[number]["key"];

export function isSchoolThemeKey(value: string): value is SchoolThemeKey {
  return SCHOOL_THEMES.some((theme) => theme.key === value);
}
