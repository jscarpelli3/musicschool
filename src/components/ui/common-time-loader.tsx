"use client";

import { useEffect, useState } from "react";
import styles from "./common-time-loader.module.css";

const measureWidth = 88;
const visibleMeasureCount = 7;

export function CommonTimeLoader({ label = "Counting common time…", compact = false }: { label?: string; compact?: boolean }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 650);
    return () => window.clearInterval(timer);
  }, []);

  const measure = Math.floor(tick / 4) + 1;
  const beat = tick % 4 + 1;
  const firstMeasure = Math.max(1, measure - 18);
  const measures = Array.from({ length: measure - firstMeasure + 1 }, (_, index) => firstMeasure + index);
  const activeCenter = (visibleMeasureCount * measureWidth) / 2 - measureWidth / 2;
  const activeOffset = (measure - firstMeasure) * measureWidth;

  return <div role="status" aria-live="polite" className={`mx-auto w-full ${compact ? "max-w-md py-6" : "max-w-2xl py-12"}`}>
    <p className="text-center text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
    <div className="mt-5 text-center font-monospace text-xl tabular-nums text-ink" aria-label={`Measure ${measure}, beat ${beat}`}>
      <span className="text-brand">{measure}</span><span className="mx-3 text-muted">2</span><span className="mr-3 text-muted">3</span><span className="text-muted">4</span>
      <span aria-hidden="true" className={`ml-4 inline-block size-1.5 rounded-full bg-brand align-middle ${styles.pulse}`} />
    </div>
    <div className={`${styles.viewport} relative mt-5 h-24 overflow-hidden`}>
      <div className={`${styles.track} absolute left-0 top-0 flex h-24`} style={{ transform: `translateX(${activeCenter - activeOffset}px)` }}>
        {measures.map((measureNumber) => <Measure key={measureNumber} active={measureNumber === measure} />)}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-brand/35" aria-hidden="true" />
    </div>
    <span className="sr-only">{`Counting measure ${measure}: ${measure} 2 3 4. Current beat ${beat}.`}</span>
  </div>;
}

function Measure({ active }: { active: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 88 96" width={measureWidth} height="96" className={active ? styles.active : undefined}>
    {[28, 38, 48, 58, 68].map((y) => <line key={y} x1="0" y1={y} x2="88" y2={y} stroke="var(--ui-line)" strokeWidth="1" />)}
    <line x1="87.5" y1="28" x2="87.5" y2="68" stroke={active ? "var(--ui-brand)" : "var(--ui-muted)"} strokeWidth="1" />
    <rect x="37" y="38" width="14" height="5" rx="0.5" fill={active ? "var(--ui-brand)" : "var(--ui-muted)"} />
  </svg>;
}
