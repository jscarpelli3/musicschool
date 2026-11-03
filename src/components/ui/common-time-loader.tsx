"use client";

import { useEffect, useState } from "react";
import { CommonTimeLogo } from "@/components/brand/common-time-logo";
import styles from "./common-time-loader.module.css";

const measureWidth = 240;
const countSequence = Array.from({ length: 128 }, (_, index) => ({
  beat: index % 4 + 1,
  value: index % 4 === 0 ? Math.floor(index / 4) + 1 : index % 4 + 1,
}));

export function CommonTimeLoader({ label = "Counting common time…", compact = false }: { label?: string; compact?: boolean }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 600);
    return () => window.clearInterval(timer);
  }, []);

  const measure = Math.floor(tick / 4) + 1;
  const beat = tick % 4 + 1;
  const firstMeasure = Math.max(1, measure - 18);
  const measures = Array.from({ length: measure - firstMeasure + 1 }, (_, index) => firstMeasure + index);
  const activeOffset = (measure - firstMeasure) * measureWidth;

  return <div role="status" aria-live="polite" aria-label={label} className={`mx-auto w-full ${compact ? "max-w-2xl py-6" : "max-w-4xl py-10"}`}>
    <CommonTimeLogo priority className="mx-auto w-56 sm:w-72" />
    <p className="-mt-4 text-center text-sm tracking-[0.18em] text-muted">Loading…</p>
    <div className={`${styles.viewport} relative mt-3 h-44 overflow-hidden`}>
      <div className={`${styles.track} absolute left-1/2 top-0 flex h-40`} style={{ transform: `translateX(-${activeOffset + measureWidth / 2}px)` }}>
        {measures.map((measureNumber) => <Measure key={measureNumber} active={measureNumber === measure} />)}
      </div>
    </div>
    <div className="relative mx-auto h-14 w-full max-w-[45rem] font-monospace text-4xl tabular-nums" aria-label={`Measure ${measure}, beat ${beat}`}>
      {countSequence.map((count, index) => <span key={index} aria-hidden="true" className={`${styles.countFlash} absolute top-0`} style={{ animationDelay: `${index * 0.6}s`, left: `calc(50% - ${measureWidth / 2}px + ${(count.beat - 0.5) * (measureWidth / 4)}px)` }}>{count.value}</span>)}
    </div>
    <span className="sr-only">{`Counting measure ${measure}: ${measure} 2 3 4. Current beat ${beat}.`}</span>
  </div>;
}

function Measure({ active }: { active: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 240 160" width={measureWidth} height="160" className={active ? styles.active : undefined}>
    {[42, 60, 78, 96, 114].map((y) => <line key={y} x1="0" y1={y} x2="240" y2={y} stroke="var(--ui-line)" strokeWidth="1.75" />)}
    <line x1="239" y1="42" x2="239" y2="114" stroke={active ? "var(--ui-brand)" : "var(--ui-muted)"} strokeWidth="2" />
    <rect x="106" y="60" width="28" height="10" rx="1" fill={active ? "var(--ui-brand)" : "var(--ui-muted)"} />
  </svg>;
}
