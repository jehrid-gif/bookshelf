import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedAuthToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  // TEMPORARY diagnostic — bypass everything unconditionally to determine
  // whether a stubborn redirect is coming from this middleware at all.
  // Remove this block immediately after the test.
  return NextResponse.next();

  // Vercel Cron hits this with its own bearer-token auth, not the login
  // cookie — the route itself checks CRON_SECRET.
  if (req.nextUrl.pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  // TEMPORARY — the matcher's regex exclusion below hasn't reliably kept
  // Next.js from invoking middleware for this path, so bypass it here in
  // plain code instead. Remove this block together with the /diag-check
  // page once the mystery is resolved.
  if (
    req.nextUrl.pathname === "/app/diag-check" ||
    req.nextUrl.pathname.startsWith("/app/diag-check/")
  ) {
    return NextResponse.next();
  }

  const expected = await expectedAuthToken();
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const authed = !!expected && token === expected;

  if (authed) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/login|diag-check).*)",
  ],
};
