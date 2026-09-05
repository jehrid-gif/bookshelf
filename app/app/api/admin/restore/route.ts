import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { BACKUP_COLUMNS, normalizeBackupRow } from "@/lib/adminBackup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CONFIRM_PHRASE = "REPLACE ALL BOOKS";
const CHUNK_SIZE = 200; // stay well under Postgres's per-query parameter limit

// Debug-page tool: wholesale-replaces every row in `books` with the contents
// of a previously-downloaded /api/export JSON backup. Every row is
// validated before anything touches the database, and the delete+insert
// itself runs in one transaction, so a bad file or a mid-way error leaves
// the existing library completely untouched rather than half-restored.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  if (body?.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: `You must pass confirm: "${CONFIRM_PHRASE}" to run a restore.` },
      { status: 400 }
    );
  }

  const books = body?.books;
  if (!Array.isArray(books) || books.length === 0) {
    return NextResponse.json(
      { error: "The backup file has no books in it — nothing to restore." },
      { status: 400 }
    );
  }

  const errors: string[] = [];
  const rows: Record<string, unknown>[] = [];
  books.forEach((raw, i) => {
    const { row, error } = normalizeBackupRow(raw, i);
    if (error) errors.push(error);
    else if (row) rows.push(row);
  });

  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: `The backup file has ${errors.length} problem row(s) — nothing was changed.`,
        details: errors.slice(0, 20),
      },
      { status: 400 }
    );
  }

  try {
    await withTransaction(async (client) => {
      await client.query("DELETE FROM books");

      for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
        const chunk = rows.slice(start, start + CHUNK_SIZE);
        const params: unknown[] = [];
        const valuesSql = chunk
          .map((row) => {
            const placeholders = BACKUP_COLUMNS.map((col) => {
              params.push(row[col]);
              return `$${params.length}`;
            });
            return `(${placeholders.join(",")})`;
          })
          .join(",");
        await client.query(
          `INSERT INTO books (${BACKUP_COLUMNS.join(",")}) VALUES ${valuesSql}`,
          params
        );
      }
    });
  } catch (err: any) {
    // The transaction rolled back — the existing library is untouched.
    return NextResponse.json(
      { error: `Restore failed, no changes were made: ${err.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ restored: rows.length });
}
