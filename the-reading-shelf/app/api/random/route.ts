import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Book } from "@/lib/types";
import { computeReadNext } from "@/lib/readNext";

export const dynamic = "force-dynamic";

// Picks a random book that is actually ready to read right now: either
// standalone/no series, or the unlocked next entry in its series.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const world = url.searchParams.get("world");

    const books = await query<Book>(
      `SELECT * FROM books WHERE status = 'to_read'`
    );

    const readNext = computeReadNext(books);
    const unlockedInSeries = new Set(readNext.map((r) => r.book.trello_id));

    let pool = books.filter(
      (b) => !b.series || !b.series.trim() || unlockedInSeries.has(b.trello_id)
    );

    if (world) {
      pool = pool.filter((b) => b.worlds.includes(world));
    }

    if (pool.length === 0) {
      return NextResponse.json({ error: "No eligible books found" }, { status: 404 });
    }

    const pick = pool[Math.floor(Math.random() * pool.length)];
    return NextResponse.json(pick);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
