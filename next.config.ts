import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Content-Security-Policy", value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Browser acceptance tests build beside an active local dev server. Keeping
  // their output separate prevents concurrent Next processes from sharing and
  // corrupting the same build directory.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    // Avatar uploads accept 5 MB images. Multipart encoding adds a small amount
    // of overhead to the raw file size before the Server Action receives it.
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() { return [{ source: "/(.*)", headers: securityHeaders }]; },
};

export default nextConfig;
