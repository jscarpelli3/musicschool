import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const sans = DM_Sans({
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
  title: "Common Time",
  description: "Scheduling, billing, and communication for independent music schools.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
