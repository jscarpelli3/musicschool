import Image from "next/image";
import type { ReactNode } from "react";

type AuthPhotoShellProps = {
  children: ReactNode;
  imageSrc: string;
  imageAlt: string;
  imagePosition?: string;
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
  kicker: string;
  title: string;
};

export function AuthPhotoShell({ children, imageSrc, imageAlt, imagePosition = "center", photographer, photographerUrl, photoUrl, kicker, title }: AuthPhotoShellProps) {
  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1.1fr)_minmax(28rem,0.9fr)]">
      <aside className="relative min-h-64 overflow-hidden border-b border-line lg:min-h-screen lg:border-b-0 lg:border-r">
        <Image src={imageSrc} alt={imageAlt} fill sizes="(min-width: 1024px) 55vw, 100vw" loading="eager" className="object-cover" style={{ objectPosition: imagePosition }} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-ink/10" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-9 lg:p-12">
          <p className="text-xs uppercase tracking-[0.16em] text-white/70">{kicker}</p>
          <p className="mt-3 max-w-xl font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">{title}</p>
          <p className="mt-5 text-[0.65rem] text-white/65">
            Photo by <a className="underline underline-offset-2 hover:text-white" href={photographerUrl}>{photographer}</a> on <a className="underline underline-offset-2 hover:text-white" href={photoUrl}>Unsplash</a>
          </p>
        </div>
      </aside>
      <div className="flex items-center justify-center px-6 py-14 sm:px-10 lg:px-14 lg:py-20">
        {children}
      </div>
    </main>
  );
}
