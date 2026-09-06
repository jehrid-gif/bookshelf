import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedAuthToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  // Vercel Cron hits this with its own bearer-token auth, not the login
  // cookie — the route itself checks CRON_SECRET.
  if (req.nextUrl.pathname.startsWith("/api/cron/")) {
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
