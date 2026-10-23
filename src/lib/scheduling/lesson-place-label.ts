export function lessonPlaceLabel(place: { name: string; kind: string }) {
  if (place.kind === "student_home") return "Student home";
  if (place.kind === "online") return "Online";
  return place.name;
}
