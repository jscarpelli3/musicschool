import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export class RequestBoundaryError extends Error {
  constructor(readonly code: "untrusted_origin" | "rate_limited", readonly retryAfter = 0) {
    super(code);
    this.name = "RequestBoundaryError";
  }
}

function trustedOrigins() {
  const values = new Set<string>();
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try { values.add(new URL(configured).origin); } catch { /* deployment configuration is reported by the caller */ }
  }
  values.add("https://app.commontime.studio");
  if (process.env.NODE_ENV !== "production") {
    values.add("http://localhost:3000");
    values.add("http://127.0.0.1:3000");
  }
  const preview = process.env.VERCEL_URL?.trim();
  if (preview) values.add(`https://${preview}`);
  return values;
}

export function assertTrustedBrowserRequest(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || (origin && !trustedOrigins().has(origin))) {
    throw new RequestBoundaryError("untrusted_origin");
  }
  if (process.env.NODE_ENV === "production" && !origin) throw new RequestBoundaryError("untrusted_origin");
}

export async function assertTrustedServerActionRequest() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const fetchSite = requestHeaders.get("sec-fetch-site");
  if (fetchSite === "cross-site" || (origin && !trustedOrigins().has(origin))) {
    throw new RequestBoundaryError("untrusted_origin");
  }
  if (process.env.NODE_ENV === "production" && !origin) {
    throw new RequestBoundaryError("untrusted_origin");
  }
  return requestHeaders;
}

export async function assertTrustedMarketingServerActionRequest() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const fetchSite = requestHeaders.get("sec-fetch-site");
  const allowed = new Set(["https://www.commontime.studio", "https://commontime.studio"]);
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }
  if (fetchSite === "cross-site" || !origin || !allowed.has(origin)) throw new RequestBoundaryError("untrusted_origin");
  return requestHeaders;
}

function rateLimitSecret() {
  const secret = process.env.SECURITY_RATE_LIMIT_SECRET?.trim() || process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret) throw new Error("A server rate-limit secret is required.");
  return secret;
}

function digest(value: string) {
  return createHmac("sha256",rateLimitSecret()).update(value).digest("hex");
}

export function requestIp(requestHeaders: Headers) {
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")?.trim()
    || "unknown";
}

export async function enforceRateLimit(input: {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
  blockSeconds?: number;
}) {
  const { data,error } = await createAdminClient().rpc("consume_security_rate_limit", {
    p_scope: input.scope,
    p_subject_hash: digest(input.subject),
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
    p_block_seconds: input.blockSeconds ?? 60,
  });
  if (error || !data?.[0]) throw new Error("Rate-limit validation is unavailable.");
  if (!data[0].allowed) throw new RequestBoundaryError("rate_limited",data[0].retry_after_seconds);
  return data[0];
}

export async function protectServerAction(input: {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
  blockSeconds?: number;
}) {
  const requestHeaders = await assertTrustedServerActionRequest();
  await enforceRateLimit({ ...input,subject: `${input.subject}|ip:${requestIp(requestHeaders)}` });
}
