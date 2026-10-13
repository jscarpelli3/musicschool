"use client";

import { useEffect, useRef, useState, type ReactNode, type UIEvent } from "react";
import "./horizontal-scroll-frame.css";

export function HorizontalScrollFrame({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [position, setPosition] = useState({ left: false, right: true });

  function readPosition(element: HTMLDivElement) {
    const max = element.scrollWidth - element.clientWidth;
    setPosition({ left: element.scrollLeft > 2, right: element.scrollLeft < max - 2 });
  }

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      setContentWidth(body.scrollWidth);
      readPosition(body);
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    if (body.firstElementChild) observer.observe(body.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  function sync(source: "rail" | "body", event: UIEvent<HTMLDivElement>) {
    const target = source === "rail" ? bodyRef.current : railRef.current;
    if (target && Math.abs(target.scrollLeft - event.currentTarget.scrollLeft) > 1) {
      target.scrollLeft = event.currentTarget.scrollLeft;
    }
    if (source === "body") readPosition(event.currentTarget);
  }

  return (
    <div className="horizontal-scroll-frame" data-can-left={position.left} data-can-right={position.right}>
      <div ref={railRef} onScroll={(event) => sync("rail", event)} className="horizontal-scroll-rail" aria-hidden="true">
        <div style={{ width: contentWidth, height: 1 }} />
      </div>
      <div ref={bodyRef} onScroll={(event) => sync("body", event)} className="horizontal-scroll-body">
        {children}
      </div>
    </div>
  );
}
