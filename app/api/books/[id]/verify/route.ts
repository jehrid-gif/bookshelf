import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import type { Book } from "@/lib/types";

export const dynamic = "force-dynamic";

// Manually confirms a book's cover/description/ISBN are correct without
// touching any of them — unlike Refetch, this never talks to Google Books
// and never overwrites what's already on the row. For when you've already
// fixed a bad match by hand and just want the "needs review" flag cleared,
// instead of gambling on another automated search turning up a better one.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updated = await queryOne<Book>(
      `UPDATE books SET enrichment_status = 'matched', enrichment_checked_at = now()
       WHERE trello_id = $1 RETURNING *`,
      [params.id]
    );
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
