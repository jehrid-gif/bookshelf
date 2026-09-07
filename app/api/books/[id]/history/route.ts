import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Book } from "@/lib/types";

export const dynamic = "force-dynamic";

// Returns every book in the same "read again" chain as `id` — the original
// plus all its reread copies — sorted oldest-started first. Works from
// either end of the chain: viewing the original or any reread returns the
// same full list, since rereads always link to the true root (see the
// read-again route). A dangling original_id (the original was since
// deleted) just means that row won't come back — not an error.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rows = await query<Book>(
      `SELECT b.* FROM books b
       WHERE b.trello_id = $1
          OR b.original_id = $1
          OR b.trello_id = (SELECT original_id FROM books WHERE trello_id = $1)
          OR b.original_id = (SELECT original_id FROM books WHERE trello_id = $1)
       ORDER BY COALESCE(b.date_started, b.created_at) ASC`,
      [params.id]
    );
    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
