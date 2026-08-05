import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: "variable",
});

const display = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: "variable",
});

export const metadata: Metadata = {
  title: "Music School",
  description: "Scheduling and operations for modern music schools.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
