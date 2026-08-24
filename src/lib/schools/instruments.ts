export const COMMON_INSTRUMENTS = [
  "Piano",
  "Voice",
  "Guitar",
  "Bass guitar",
  "Drums",
  "Violin",
  "Viola",
  "Cello",
  "Double bass",
  "Flute",
  "Clarinet",
  "Saxophone",
  "Trumpet",
  "Trombone",
  "French horn",
  "Ukulele",
] as const;

export function normalizeInstrumentNames(values: string[]) {
  const unique = new Map<string, string>();
  for (const rawValue of values) {
    const value = rawValue.trim().replace(/\s+/g, " ");
    if (value && value.length <= 80) unique.set(value.toLocaleLowerCase(), value);
  }
  return [...unique.values()].slice(0, 40);
}
