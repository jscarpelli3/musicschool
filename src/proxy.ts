import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/supabase/proxy";

const MARKETING_HOSTS = new Set(["commontime.studio", "www.commontime.studio"]);

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
      const destination = new URL("https://www.commontime.studio");
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

    if (request.nextUrl.pathname !== "/") {
      return NextResponse.redirect(new URL("https://www.commontime.studio"), 307);
    }

    const destination = request.nextUrl.clone();
    destination.pathname = "/coming-soon";
    return NextResponse.rewrite(destination);
  }

  const response = await refreshSession(request);
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
