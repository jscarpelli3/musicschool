import type { Metadata } from "next";
import { Bricolage_Grotesque, Cormorant_Garamond, DM_Sans, Fraunces, Manrope, Newsreader, Space_Mono } from "next/font/google";
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

const grotesk = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-grotesk",
  weight: "variable",
});

const contemporary = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-contemporary", weight: "variable" });
const expressive = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-expressive", weight: "variable" });
const literary = Cormorant_Garamond({ subsets: ["latin"], display: "swap", variable: "--font-literary", weight: ["400", "500", "600"] });
const monospace = Space_Mono({ subsets: ["latin"], display: "swap", variable: "--font-monospace", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Common Time",
  description: "Scheduling, billing, and communication for independent music schools.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${grotesk.variable} ${contemporary.variable} ${expressive.variable} ${literary.variable} ${monospace.variable}`}>
      <body>{children}</body>
    </html>
  );
}
