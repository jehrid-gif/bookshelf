import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rows = await query(
      `UPDATE upcoming_releases SET dismissed = true WHERE google_id = $1 RETURNING google_id`,
      [params.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
