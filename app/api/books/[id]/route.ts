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
