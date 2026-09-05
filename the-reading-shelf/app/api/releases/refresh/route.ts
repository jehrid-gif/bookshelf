import { NextResponse } from "next/server";
import { refreshReleases } from "@/lib/releases";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Manual, session-authenticated refresh — the user clicking "Refresh now" on
// the Upcoming Releases page. Already covered by the app's login middleware.
export async function POST() {
  try {
    const result = await refreshReleases();
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
