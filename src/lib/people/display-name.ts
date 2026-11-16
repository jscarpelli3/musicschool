export function personDisplayName(person: {
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
}) {
  return [person.preferred_name?.trim() || person.first_name?.trim(), person.last_name?.trim()]
    .filter(Boolean)
    .join(" ");
}
