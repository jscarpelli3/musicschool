"use client";

import { useEffect, useState } from "react";
import styles from "./common-time-loader.module.css";

const measureWidth = 144;
const visibleMeasureCount = 5;

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
    <div className="mt-5 flex justify-center font-monospace text-2xl tabular-nums" aria-label={`Measure ${measure}, beat ${beat}`}>
      {[measure, 2, 3, 4].map((count, index) => <span key={index} className={`${styles.countBeat} ${beat === index + 1 ? styles.countBeatActive : ""}`}>{count}</span>)}
    </div>
    <div className={`${styles.viewport} relative mt-5 h-32 overflow-hidden`}>
      <div className={`${styles.track} absolute left-0 top-1 flex h-28`} style={{ transform: `translateX(${activeCenter - activeOffset}px)` }}>
        {measures.map((measureNumber) => <Measure key={measureNumber} active={measureNumber === measure} />)}
      </div>
      <div aria-hidden="true" className={`${styles.commonTime} pointer-events-none absolute left-4 top-[35px] z-10 grid h-14 w-11 place-items-center text-5xl italic leading-none text-brand`}>C</div>
    </div>
    <span className="sr-only">{`Counting measure ${measure}: ${measure} 2 3 4. Current beat ${beat}.`}</span>
  </div>;
}

function Measure({ active }: { active: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 144 112" width={measureWidth} height="112" className={active ? styles.active : undefined}>
    {[34, 46, 58, 70, 82].map((y) => <line key={y} x1="0" y1={y} x2="144" y2={y} stroke="var(--ui-line)" strokeWidth="1.25" />)}
    <line x1="143.25" y1="34" x2="143.25" y2="82" stroke={active ? "var(--ui-brand)" : "var(--ui-muted)"} strokeWidth="1.5" />
    <rect x="62" y="46" width="20" height="7" rx="0.75" fill={active ? "var(--ui-brand)" : "var(--ui-muted)"} />
  </svg>;
}
