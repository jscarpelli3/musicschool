import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { OwnerNotifications } from "@/components/notifications/owner-notifications";

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
  title: "Common Time",
  description: "Scheduling, billing, and communication for independent music schools.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body><OwnerNotifications />{children}</body>
    </html>
  );
}
