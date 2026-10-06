export function formatCompactDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1].slice(-2)}`;
}
