export const SCHOOL_FONTS = [
  { key: "editorial", name: "Editorial", description: "Newsreader headlines with a quiet modern interface.", sample: "A considered studio" },
  { key: "grotesk", name: "Grotesk", description: "Characterful geometric headlines with clean supporting type.", sample: "A lively school" },
  { key: "swiss", name: "Swiss", description: "Direct, neutral sans serif type throughout the workspace.", sample: "A clear schedule" },
  { key: "traditional", name: "Traditional", description: "Familiar bookish headings paired with an understated interface.", sample: "A classic program" },
  { key: "contemporary", name: "Contemporary", description: "Open, geometric type with a friendly everyday rhythm.", sample: "A modern lesson" },
  { key: "expressive", name: "Expressive", description: "Warm, sculpted headlines paired with a restrained interface.", sample: "Music with character" },
  { key: "literary", name: "Literary", description: "Elegant high-contrast headings for a more formal voice.", sample: "An expressive recital" },
  { key: "monospace", name: "Monospace", description: "Crisp fixed-width type for a technical, rhythmic workspace.", sample: "Tempo / time / tone" },
] as const;

export type SchoolFontKey = (typeof SCHOOL_FONTS)[number]["key"];

export function isSchoolFontKey(value: string): value is SchoolFontKey {
  return SCHOOL_FONTS.some((font) => font.key === value);
}
