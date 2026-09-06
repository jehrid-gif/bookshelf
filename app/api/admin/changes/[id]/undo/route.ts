import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type { Book } from "@/lib/types";
import { BACKUP_COLUMNS } from "@/lib/adminBackup";
import { logChange } from "@/lib/changeLog";
import type { BookChange } from "../../route";

export const dynamic = "force-dynamic";

// Reverses one Change Log entry. Scoped to exactly what that entry changed
// (not a blanket "restore the whole old row"), so undoing an older edit
// can't accidentally clobber unrelated changes made to the same book since
// then. Undoing itself is logged too, so the log stays a complete, honest
// history rather than quietly erasing what happened.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const entry = await queryOne<BookChange>(`SELECT * FROM book_changes WHERE id = $1`, [
      params.id,
    ]);
    if (!entry) {
      return NextResponse.json({ error: "That change log entry doesn't exist." }, { status: 404 });
    }
    if (entry.undone_at) {
      return NextResponse.json({ error: "This was already undone." }, { status: 400 });
    }

    const existing = await queryOne<Book>(`SELECT * FROM books WHERE trello_id = $1`, [
      entry.book_id,
    ]);

    if (entry.action === "created") {
      if (!existing) {
        return NextResponse.json(
          { error: "That book no longer exists — nothing to undo." },
          { status: 400 }
        );
      }
      await query(`DELETE FROM books WHERE trello_id = $1`, [entry.book_id]);
      await logChange({
        bookId: entry.book_id,
        bookTitle: entry.book_title,
        action: "deleted",
        before: existing,
      });
    } else if (entry.action === "deleted") {
      if (existing) {
        return NextResponse.json(
          { error: "A book with this ID already exists again — can't restore over it." },
          { status: 400 }
        );
      }
      if (!entry.before) {
        return NextResponse.json(
          { error: "This entry has no saved data to restore from." },
          { status: 400 }
        );
      }
      // Change Log entries recorded before `is_reread` existed have no such
      // key in their saved `before` snapshot — default it to false rather
      // than inserting an explicit NULL into a NOT NULL column.
      const beforeRow = entry.before as Record<string, unknown>;
      const values = (BACKUP_COLUMNS as readonly string[]).map((col) =>
        col === "is_reread" && beforeRow[col] === undefined ? false : beforeRow[col]
      );
      const placeholders = BACKUP_COLUMNS.map((_, i) => `$${i + 1}`).join(",");
      const restored = await queryOne<Book>(
        `INSERT INTO books (${BACKUP_COLUMNS.join(",")}) VALUES (${placeholders}) RETURNING *`,
        values
      );
      await logChange({
        bookId: entry.book_id,
        bookTitle: entry.book_title,
        action: "created",
        after: restored ?? undefined,
      });
    } else {
      // "updated" — restore only the fields this specific entry changed, so
      // a later, unrelated edit to the same book is never clobbered.
      if (!existing) {
        return NextResponse.json(
          { error: "That book no longer exists — can't undo this." },
          { status: 400 }
        );
      }
      // length_category is a GENERATED ALWAYS column (derived from `pages`
      // by Postgres) — it can never be set explicitly, only recomputed as a
      // side effect of restoring `pages`. Newer log entries never record it
      // as a changed field to begin with, but this filters it out
      // defensively too, so entries logged before that fix can still be
      // undone instead of failing on the same generated-column error.
      const fields = (entry.changed_fields || []).filter((f) => f !== "length_category");
      if (fields.length === 0 || !entry.before) {
        return NextResponse.json(
          { error: "This entry has nothing restorable on it." },
          { status: 400 }
        );
      }
      const before = entry.before as Record<string, unknown>;
      const sets = fields.map((col, i) => `${col} = $${i + 1}`);
      const values = fields.map((col) => before[col]);
      values.push(entry.book_id);
      const reverted = await queryOne<Book>(
        `UPDATE books SET ${sets.join(", ")}, updated_at = now() WHERE trello_id = $${
          values.length
        } RETURNING *`,
        values
      );
      await logChange({
        bookId: entry.book_id,
        bookTitle: entry.book_title,
        action: "updated",
        before: existing,
        after: reverted ?? undefined,
      });
    }

    await query(`UPDATE book_changes SET undone_at = now() WHERE id = $1`, [entry.id]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
