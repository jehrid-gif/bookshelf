import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Book } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const books = await query<Book>(`SELECT * FROM books ORDER BY board_pos ASC`);
    const json = JSON.stringify(books, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="reading-shelf-backup-${date}.json"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
