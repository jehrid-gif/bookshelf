import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Book } from "@/lib/types";
import { computeReadNext } from "@/lib/readNext";

export const dynamic = "force-dynamic";

const WH_WORLDS = ["Warhammer 40,000", "Warhammer: Age of Sigmar"];

export async function GET() {
  try {
    const books = await query<Book>(`SELECT * FROM books WHERE status = 'to_read'`);
    const readNext = computeReadNext(books);
    const unlockedInSeries = new Set(readNext.map((r) => r.book.trello_id));

    const pool = books.filter(
      (b) =>
        b.worlds.some((w) => WH_WORLDS.includes(w)) &&
        (!b.series || !b.series.trim() || unlockedInSeries.has(b.trello_id))
    );

    if (pool.length === 0) {
      return NextResponse.json(
        { error: "No eligible Warhammer books found" },
        { status: 404 }
      );
    }

    const pick = pool[Math.floor(Math.random() * pool.length)];
    return NextResponse.json(pick);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
