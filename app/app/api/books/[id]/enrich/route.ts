import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import type { Book } from "@/lib/types";
import { enrichBook } from "@/lib/enrichment";

export const dynamic = "force-dynamic";

// Manually (re-)runs the Google Books lookup for a single book. Used by the
// "Refetch" button in the edit form — with force:true it overwrites the
// existing cover/description/isbn, letting a bad automatic match be redone.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const book = await queryOne<Book>(`SELECT * FROM books WHERE trello_id = $1`, [params.id]);
    if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let force = false;
    try {
      const body = await req.json();
      force = !!body?.force;
    } catch {
      // no body sent
    }

    const outcome = await enrichBook(book, { force });
    return NextResponse.json({ status: outcome.status, book: outcome.book ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
