import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, sha256Hex } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const expected = process.env.SITE_PASSWORD;
    if (!expected) {
      return NextResponse.json(
        { error: "Login isn't configured yet — set SITE_PASSWORD in Vercel." },
        { status: 500 }
      );
    }
    if (typeof password !== "string" || password !== expected) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }
    const token = await sha256Hex(expected);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
