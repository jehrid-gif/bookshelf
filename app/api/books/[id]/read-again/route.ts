import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { queryOne } from "@/lib/db";
import type { Book } from "@/lib/types";
import { logChange } from "@/lib/changeLog";

export const dynamic = "force-dynamic";

// "Read Again" — duplicates a finished book into a brand-new row so the
// original's history (its rating, finish date, etc.) stays intact while the
// new copy tracks a fresh read-through. The copy starts in "Reading" with
// today as its start date and a blank rating/finish date — it isn't judged
// finished until it's actually finished again.
//
// is_reread=true marks it as the same physical/owned book rather than a new
// acquisition, so it's excluded from inventory-style stats (Total Books,
// Owned) but still counts toward reading-activity stats (Finished this
// year, Pages this year) once it's completed again.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const original = await queryOne<Book>(`SELECT * FROM books WHERE trello_id = $1`, [
      params.id,
    ]);
    if (!original) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const id = randomUUID();
    const minPos = await queryOne<{ min: number | null }>(
      `SELECT MIN(board_pos) AS min FROM books`
    );
    const boardPos = (minPos?.min ?? 0) - 1000;
    const now = new Date().toISOString();

    const created = await queryOne<Book>(
      `INSERT INTO books (
        trello_id, title, author, genre, series, series_index, series_position,
        pages, status, owned, format, cover_type, special_edition, my_rating,
        moods, worlds, priority, date_added, date_started, date_finished,
        description, cover_url, isbn, board_pos, is_reread
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
      ) RETURNING *`,
      [
        id,
        original.title,
        original.author,
        original.genre,
        original.series,
        original.series_index,
        original.series_position,
        original.pages,
        "reading",
        original.owned,
        original.format,
        original.cover_type,
        original.special_edition,
        null, // my_rating — blank until this read-through is rated
        original.moods,
        original.worlds,
        original.priority,
        now, // date_added
        now, // date_started — today, not copied from the original
        null, // date_finished — blank until finished again
        original.description,
        original.cover_url,
        original.isbn,
        boardPos,
        true, // is_reread
      ]
    );

    if (created) {
      await logChange({
        bookId: created.trello_id,
        bookTitle: created.title,
        action: "created",
        after: created,
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
