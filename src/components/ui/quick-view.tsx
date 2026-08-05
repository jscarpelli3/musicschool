import type { CSSProperties, ReactNode } from "react";
import "./quick-view.css";

export function QuickView({
  children,
  delayMs = 1000,
}: {
  children: ReactNode;
  delayMs?: number;
}) {
  return (
    <span
      className="quick-view"
      aria-hidden="true"
      style={{ "--quick-view-delay": `${delayMs}ms` } as CSSProperties}
    >
      {children}
    </span>
  );
}
