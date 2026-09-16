import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy";

const MARKETING_HOSTS = new Set(["commontime.studio", "www.commontime.studio"]);
const PUBLIC_MARKETING_PATHS = new Set(["/privacy", "/terms", "/support"]);
const PROVIDER_WEBHOOK_PATHS = ["/api/stripe/webhooks", "/api/resend/webhooks", "/api/twilio/"];
const VERCEL_HOST_ENV_KEYS = ["VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"] as const;

function configuredVercelHosts() {
  return VERCEL_HOST_ENV_KEYS.flatMap((key) => {
    const host = process.env[key]?.trim().toLowerCase();
    return host ? [host] : [];
  });
}

function appHosts() {
  const hosts = new Set(["app.commontime.studio", ...configuredVercelHosts()]);
  if (process.env.NODE_ENV !== "production") {
    hosts.add("localhost");
    hosts.add("127.0.0.1");
  }
  return hosts;
}

function trustedMutationOrigins(request: NextRequest, requestHost: string) {
  const origins = new Set(["https://app.commontime.studio"]);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const requestProtocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "");
  try { origins.add(new URL(`${requestProtocol}://${requestHost}`).origin); } catch { /* malformed hosts fail the origin check below */ }
  if (process.env.APP_URL) {
    try { origins.add(new URL(process.env.APP_URL).origin); } catch { /* invalid deployment configuration is rejected below */ }
  }
  for (const host of configuredVercelHosts()) origins.add(`https://${host}`);
  return origins;
}

export async function proxy(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const hostname = requestHost.toLowerCase().replace(/:\d+$/, "");

  if (MARKETING_HOSTS.has(hostname)) {
    if (request.nextUrl.pathname === "/portal" || request.nextUrl.pathname.startsWith("/portal/")) {
      const destination = request.nextUrl.clone();
      destination.protocol = "https:";
      destination.hostname = "app.commontime.studio";
      destination.port = "";
      return NextResponse.redirect(destination, 308);
    }

    if (hostname === "commontime.studio") {
      const destination = request.nextUrl.clone();
      destination.protocol = "https:";
      destination.hostname = "www.commontime.studio";
      destination.port = "";
      return NextResponse.redirect(destination, 308);
    }

    if (request.nextUrl.pathname === "/robots.txt") {
      return new NextResponse("User-agent: *\nAllow: /\nSitemap: https://www.commontime.studio/sitemap.xml\n", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (request.nextUrl.pathname === "/sitemap.xml") {
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.commontime.studio/</loc></url></urlset>`, {
        headers: { "Content-Type": "application/xml; charset=utf-8" },
      });
    }

    if (request.nextUrl.pathname !== "/" && !PUBLIC_MARKETING_PATHS.has(request.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("https://www.commontime.studio"), 307);
    }

    if (PUBLIC_MARKETING_PATHS.has(request.nextUrl.pathname)) return NextResponse.next();

    const destination = request.nextUrl.clone();
    destination.pathname = "/coming-soon";
    return NextResponse.rewrite(destination);
  }

  if (!appHosts().has(hostname)) return new NextResponse("Unrecognized host", { status: 421 });

  const unsafeMethod = !new Set(["GET","HEAD","OPTIONS"]).has(request.method);
  const providerWebhook = PROVIDER_WEBHOOK_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));
  if (unsafeMethod && !providerWebhook) {
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "cross-site" || !origin || !trustedMutationOrigins(request, requestHost).has(origin)) {
      return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
    }
  }

  const response = await refreshSession(request);
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
