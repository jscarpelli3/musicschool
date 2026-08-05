"use client";

import { useEffect, useRef, useState } from "react";
import "./interactions.css";

const views = ["Day", "Week", "Month"];
const connections = [
  { student: "Maya Chen", lesson: "Piano · 3:00", tone: "Returning" },
  { student: "Noah Williams", lesson: "Guitar · 3:30", tone: "Trial" },
  { student: "Amelia Davis", lesson: "Voice · 4:15", tone: "Returning" },
];

function HoldButton() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function begin() {
    if (confirmed || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      setConfirmed(true);
    }, 1400);
  }

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }

  useEffect(() => cancel, []);

  return (
    <button
      type="button"
      className="hold-button mt-8 w-full px-5 py-4 text-left text-sm transition-colors data-[confirmed=true]:text-canvas"
      data-holding={holding}
      data-confirmed={confirmed}
      disabled={confirmed}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          begin();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") cancel();
      }}
    >
      {confirmed ? "Reschedule confirmed" : holding ? "Keep holding…" : "Hold to confirm reschedule"}
    </button>
  );
}

export function InteractionStudy() {
  const [view, setView] = useState(1);
  const [selected, setSelected] = useState(0);

  return (
    <>
      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line px-6 py-10 md:border-r md:border-b-0 md:px-12">
          <p className="text-sm text-brand">01 / Draw</p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
            A resting fragment becomes a full rule on intent. Use for quiet secondary actions.
          </p>
        </div>
        <div className="grid gap-5 px-6 py-10 md:grid-cols-2 md:px-16 md:py-14">
          <button className="line-action text-lg">Review Tuesday’s schedule →</button>
          <button className="line-action text-lg">Invite a teacher →</button>
        </div>
      </section>

      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line px-6 py-10 md:border-r md:border-b-0 md:px-12">
          <p className="text-sm text-brand">02 / Focus</p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
            Inputs stay materially quiet. Focus draws the working line instead of adding a glow.
          </p>
        </div>
        <div className="grid gap-10 px-6 py-10 md:grid-cols-2 md:px-16 md:py-14">
          <div className="line-field pb-3">
            <label htmlFor="student-name" className="block text-xs text-muted">Student name</label>
            <input id="student-name" className="mt-2 w-full bg-transparent text-lg outline-none" defaultValue="Maya Chen" />
          </div>
          <div className="line-field pb-3">
            <label htmlFor="instrument" className="block text-xs text-muted">Instrument</label>
            <select id="instrument" className="mt-2 w-full bg-transparent text-lg outline-none" defaultValue="Piano">
              <option>Piano</option>
              <option>Guitar</option>
              <option>Voice</option>
            </select>
          </div>
        </div>
      </section>

      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line px-6 py-10 md:border-r md:border-b-0 md:px-12">
          <p className="text-sm text-brand">03 / Track</p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
            One line travels beneath a selection, preserving spatial continuity between views.
          </p>
        </div>
        <div className="px-6 py-10 md:px-16 md:py-14">
          <div
            className="selector-track grid grid-cols-3 border-b border-line"
            style={{ "--selected-index": view } as React.CSSProperties}
          >
            {views.map((label, index) => (
              <button
                key={label}
                type="button"
                className={`py-4 text-sm transition-colors ${view === index ? "text-ink" : "text-muted hover:text-ink"}`}
                aria-pressed={view === index}
                onClick={() => setView(index)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-8 font-display text-4xl">{views[view]} schedule</p>
        </div>
      </section>

      <section className="grid border-b border-line md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line px-6 py-10 md:border-r md:border-b-0 md:px-12">
          <p className="text-sm text-brand">04 / Connect</p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
            A selected relationship crosses the gap between two datasets. The line answers “what belongs together?”
          </p>
        </div>
        <div className="relative grid grid-cols-2 gap-16 overflow-hidden px-6 py-10 md:px-16 md:py-14">
          <div>
            <p className="mb-4 text-xs text-muted">Students</p>
            {connections.map((item, index) => (
              <button
                key={item.student}
                type="button"
                onClick={() => setSelected(index)}
                className={`relative z-10 block h-16 w-full border-t border-line bg-canvas text-left text-sm transition-colors ${selected === index ? "text-brand-hover" : "text-muted hover:text-ink"}`}
              >
                {item.student}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-4 text-xs text-muted">Lessons</p>
            {connections.map((item, index) => (
              <button
                key={item.lesson}
                type="button"
                onClick={() => setSelected(index)}
                className={`relative z-10 block h-16 w-full border-t border-line bg-canvas text-left text-sm transition-colors ${selected === index ? "text-brand-hover" : "text-muted hover:text-ink"}`}
              >
                {item.lesson}
              </button>
            ))}
          </div>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            <line
              x1="45%"
              x2="55%"
              y1={105 + selected * 64}
              y2={105 + selected * 64}
              stroke="var(--ui-brand)"
              strokeWidth="1"
            />
          </svg>
        </div>
      </section>

      <section className="grid md:grid-cols-[1fr_2fr]">
        <div className="border-b border-line px-6 py-10 md:border-r md:border-b-0 md:px-12">
          <p className="text-sm text-brand">05 / Confirm</p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted">
            Destructive or consequential actions may require a deliberate hold. Fill shows elapsed commitment; release cancels.
          </p>
        </div>
        <div className="px-6 py-10 md:px-16 md:py-14">
          <p className="font-display text-3xl">Move Maya’s lesson to 4:30?</p>
          <p className="mt-3 text-sm text-muted">Tuesday, August 11 · Lena Ortiz</p>
          <HoldButton />
        </div>
      </section>
    </>
  );
}
