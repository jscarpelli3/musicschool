import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Common Time",
    short_name: "Common Time",
    description: "Scheduling, billing, and communication for independent music schools.",
    start_url: "/",
    display: "standalone",
    background_color: "#02060c",
    theme_color: "#02060c",
    icons: [
      { src: "/app-icons/common-time-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icons/common-time-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
