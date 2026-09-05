import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { UpcomingRelease } from "@/lib/types";
import { isRelevantRelease } from "@/lib/releases";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const releases = await query<UpcomingRelease>(
      `SELECT * FROM upcoming_releases WHERE dismissed = false ORDER BY published_date ASC NULLS LAST`
    );
    // Drop anything that's aged out of the relevant window (released more
    // than ~30 days ago) rather than pruning the table — a later refresh
    // that turns up the same google_id again will just update it in place.
    const visible = releases.filter((r) => isRelevantRelease(r.published_date));
    return NextResponse.json(visible);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
