export const SCHOOL_FONTS = [
  { key: "editorial", name: "Editorial", description: "Newsreader headlines with a quiet modern interface.", sample: "A considered studio" },
  { key: "grotesk", name: "Grotesk", description: "Characterful geometric headlines with clean supporting type.", sample: "A lively school" },
  { key: "swiss", name: "Swiss", description: "Direct, neutral sans serif type throughout the workspace.", sample: "A clear schedule" },
  { key: "traditional", name: "Traditional", description: "Familiar bookish headings paired with an understated interface.", sample: "A classic program" },
] as const;

export type SchoolFontKey = (typeof SCHOOL_FONTS)[number]["key"];

export function isSchoolFontKey(value: string): value is SchoolFontKey {
  return SCHOOL_FONTS.some((font) => font.key === value);
}
