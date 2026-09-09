import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type { Book } from "@/lib/types";
import { logChange } from "@/lib/changeLog";

export const dynamic = "force-dynamic";

const EDITABLE_COLUMNS = [
  "title",
  "author",
  "genre",
  "series",
  "series_index",
  "series_position",
  "pages",
  "status",
  "owned",
  "format",
  "cover_type",
  "special_edition",
  "my_rating",
  "moods",
  "worlds",
  "priority",
  "date_added",
  "date_started",
  "date_finished",
  "description",
  "cover_url",
  "isbn",
  "board_pos",
];

// Finishing a book is the natural moment to line up what's next in its
// series — this nudges the very next entry's Priority flag on so it
// surfaces at the top of the To Read column (see app/page.tsx) without a
// manual trip back here. Only ever ADDS the flag: it never clears Priority
// on anything, since you may genuinely be partway through several series
// in parallel and each deserves its own nudge independently.
async function bumpNextInSeriesPriority(book: Book): Promise<void> {
  if (!book.series || book.series_index === null || book.series_index === undefined) return;
  try {
    const next = await queryOne<Book>(
      `SELECT * FROM books
       WHERE series = $1
         AND series_index IS NOT NULL
         AND series_index > $2
         AND status = 'to_read'
         AND priority = false
         AND is_reread = false
         AND trello_id <> $3
       ORDER BY series_index ASC
       LIMIT 1`,
      [book.series, book.series_index, book.trello_id]
    );
    if (!next) return;

    const nextUpdated = await queryOne<Book>(
      `UPDATE books SET priority = true, updated_at = now() WHERE trello_id = $1 RETURNING *`,
      [next.trello_id]
    );
    if (!nextUpdated) return;

    await logChange({
      bookId: nextUpdated.trello_id,
      bookTitle: nextUpdated.title,
      action: "updated",
      before: next,
      after: nextUpdated,
    });
  } catch {
    // Best-effort nudge — must never block the status update that
    // triggered it, so any failure here is swallowed.
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const book = await queryOne<Book>(`SELECT * FROM books WHERE trello_id = $1`, [
    params.id,
  ]);
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(book);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const col of EDITABLE_COLUMNS) {
      if (Object.prototype.hasOwnProperty.call(body, col)) {
        let v = body[col];
        if (v === "") v = null;
        sets.push(`${col} = $${i}`);
        values.push(v);
        i++;
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const before = await queryOne<Book>(`SELECT * FROM books WHERE trello_id = $1`, [
      params.id,
    ]);
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    sets.push(`updated_at = now()`);
    values.push(params.id);

    const updated = await queryOne<Book>(
      `UPDATE books SET ${sets.join(", ")} WHERE trello_id = $${i} RETURNING *`,
      values
    );

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await logChange({
      bookId: updated.trello_id,
      bookTitle: updated.title,
      action: "updated",
      before,
      after: updated,
    });

    if (before.status !== "finished" && updated.status === "finished") {
      await bumpNextInSeriesPriority(updated);
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rows = await query<Book>(`DELETE FROM books WHERE trello_id = $1 RETURNING *`, [
      params.id,
    ]);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await logChange({
      bookId: rows[0].trello_id,
      bookTitle: rows[0].title,
      action: "deleted",
      before: rows[0],
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
