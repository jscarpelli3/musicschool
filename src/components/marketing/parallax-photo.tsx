"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type ParallaxPhotoProps = {
  src: string;
  alt: string;
  sizes: string;
  objectPosition?: string;
  tintClassName: string;
};

export function ParallaxPhoto({ src, alt, sizes, objectPosition = "center", tintClassName }: ParallaxPhotoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = container.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const sectionCenter = rect.top + rect.height / 2;
      const progress = Math.max(-1, Math.min(1, (sectionCenter - viewportCenter) / (window.innerHeight + rect.height)));
      image.style.transform = `translate3d(0, ${progress * 72}px, 0) scale(1.08)`;
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={containerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div ref={imageRef} className="absolute -inset-y-[12%] inset-x-0 will-change-transform">
        <Image src={src} alt={alt} fill sizes={sizes} loading="eager" className="object-cover" style={{ objectPosition }} />
      </div>
      <div className={`absolute inset-0 ${tintClassName}`} />
    </div>
  );
}
