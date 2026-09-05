import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export interface BookChange {
  id: string;
  book_id: string;
  book_title: string;
  action: "created" | "updated" | "deleted";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changed_fields: string[];
  undone_at: string | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const limitParam = parseInt(req.nextUrl.searchParams.get("limit") || "150", 10);
    const limit = Math.min(Math.max(Number.isNaN(limitParam) ? 150 : limitParam, 1), 300);
    const rows = await query<BookChange>(
      `SELECT * FROM book_changes ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
