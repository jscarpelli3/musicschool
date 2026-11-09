import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Common Time",
    short_name: "Common Time",
    description: "Scheduling, billing, and communication for independent music schools.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#02060c",
    theme_color: "#02060c",
    icons: [
      { src: "/app-icons/common-time-192.png", sizes: "192x192", type: "image/png", purpose:"any" },
      { src: "/app-icons/common-time-512.png", sizes: "512x512", type: "image/png", purpose:"any" },
    ],
  };
}
