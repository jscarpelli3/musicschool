export function DragHandle({ active = false }: { active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid w-3 shrink-0 grid-cols-2 gap-0.5 transition-opacity group-hover:opacity-100 ${active ? "opacity-100" : "opacity-45"}`}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className="h-0.5 w-0.5 bg-current" />
      ))}
    </span>
  );
}
