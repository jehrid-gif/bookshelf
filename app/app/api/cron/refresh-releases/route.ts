import { NextRequest, NextResponse } from "next/server";
import { refreshReleases } from "@/lib/releases";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron calls this directly (no rs_auth cookie), authenticating with
// a bearer token instead. This route is excluded from the login middleware
// (see middleware.ts) so it must check the secret itself.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshReleases();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
