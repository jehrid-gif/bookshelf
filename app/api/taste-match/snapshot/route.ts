import { NextRequest, NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SnapshotRow {
  book_id: string;
  rank: number;
  score: number;
}

// The "as of last time you looked" ranking for the Discover panel's Best
// Match tab — a single current snapshot, not a history. GET reads it so the
// client can diff today's fresh ranking against it (up/down/new markers);
// PUT replaces it wholesale with the ranking just shown, becoming the
// baseline for the next comparison.
export async function GET() {
  try {
    const rows = await query<SnapshotRow>(
      `SELECT book_id, rank, score FROM taste_match_snapshot ORDER BY rank ASC`
    );
    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const entries = Array.isArray(body?.entries) ? body.entries : null;
    if (!entries) {
      return NextResponse.json({ error: "Body must include an `entries` array" }, { status: 400 });
    }
    for (const e of entries) {
      if (
        typeof e?.book_id !== "string" ||
        !Number.isInteger(e?.rank) ||
        typeof e?.score !== "number"
      ) {
        return NextResponse.json(
          { error: "Each entry needs book_id (string), rank (integer), score (number)" },
          { status: 400 }
        );
      }
    }

    await withTransaction(async (client) => {
      await client.query(`DELETE FROM taste_match_snapshot`);
      for (const e of entries as SnapshotRow[]) {
        await client.query(
          `INSERT INTO taste_match_snapshot (book_id, rank, score) VALUES ($1, $2, $3)`,
          [e.book_id, e.rank, e.score]
        );
      }
    });

    return NextResponse.json({ ok: true, count: entries.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
