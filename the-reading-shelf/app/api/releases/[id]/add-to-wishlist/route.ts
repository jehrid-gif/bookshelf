import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { query, queryOne } from "@/lib/db";
import type { Book, UpcomingRelease } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const release = await queryOne<UpcomingRelease>(
      `SELECT * FROM upcoming_releases WHERE google_id = $1`,
      [params.id]
    );
    if (!release) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const id = randomUUID();
    const minPos = await queryOne<{ min: number | null }>(
      `SELECT MIN(board_pos) AS min FROM books`
    );
    const boardPos = (minPos?.min ?? 0) - 1000;

    const created = await queryOne<Book>(
      `INSERT INTO books (
        trello_id, title, author, genre, status, owned, worlds, moods,
        date_added, cover_url, board_pos
      ) VALUES ($1,$2,$3,$4,'wishlist', false, $5, '{}', now(), $6, $7)
      RETURNING *`,
      [
        id,
        release.title,
        release.author,
        release.genre_guess,
        release.world_guess ? [release.world_guess] : [],
        release.cover_url,
        boardPos,
      ]
    );

    await query(
      `UPDATE upcoming_releases SET added_to_wishlist = true WHERE google_id = $1`,
      [params.id]
    );

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
