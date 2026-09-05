import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, queryOne } from "@/lib/db";
import type { Book, BookInput } from "@/lib/types";
import { enrichBook } from "@/lib/enrichment";
import { logChange } from "@/lib/changeLog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const books = await query<Book>(
      `SELECT * FROM books ORDER BY board_pos ASC, title ASC`
    );
    return NextResponse.json(books);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function nn<T>(v: T | undefined | null): T | null {
  return v === undefined || v === ("" as any) ? null : v;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BookInput;
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const id = randomUUID();

    // Place new books at the front of the shelf by default.
    const minPos = await queryOne<{ min: number | null }>(
      `SELECT MIN(board_pos) AS min FROM books`
    );
    const boardPos = (minPos?.min ?? 0) - 1000;

    const created = await queryOne<Book>(
      `INSERT INTO books (
        trello_id, title, author, genre, series, series_index, series_position,
        pages, status, owned, format, cover_type, special_edition, my_rating,
        moods, worlds, priority, date_added, date_started, date_finished,
        description, cover_url, isbn, board_pos
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
      ) RETURNING *`,
      [
        id,
        body.title.trim(),
        nn(body.author),
        nn(body.genre),
        nn(body.series),
        nn(body.series_index),
        nn(body.series_position),
        nn(body.pages),
        body.status || "to_read",
        body.owned ?? true,
        nn(body.format),
        nn(body.cover_type),
        body.special_edition ?? false,
        nn(body.my_rating),
        body.moods ?? [],
        body.worlds ?? [],
        body.priority ?? false,
        body.date_added ?? new Date().toISOString(),
        nn(body.date_started),
        nn(body.date_finished),
        nn(body.description),
        nn(body.cover_url),
        nn(body.isbn),
        boardPos,
      ]
    );

    // Best-effort: try to fill in cover/description/isbn right away so a
    // freshly-added book shows real cover art immediately. Never let a
    // Google Books hiccup block adding the book itself.
    let finalBook = created;
    if (created) {
      try {
        const outcome = await enrichBook(created);
        if (outcome.book) finalBook = outcome.book;
      } catch {
        // ignore — book is already saved, enrichment can happen later
      }
    }

    if (finalBook) {
      await logChange({
        bookId: finalBook.trello_id,
        bookTitle: finalBook.title,
        action: "created",
        after: finalBook,
      });
    }

    return NextResponse.json(finalBook, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
