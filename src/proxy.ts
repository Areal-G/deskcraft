import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/demo/cookie";

const PROTECTED_PREFIXES = ["/account", "/admin"];

/**
 * Redirects visitors without a demo session away from protected areas. This is
 * a convenience layer only: pages and server actions check the user themselves.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isSignedIn = Boolean(decodeSession(request.cookies.get(SESSION_COOKIE)?.value).u);

  if (!isSignedIn && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
