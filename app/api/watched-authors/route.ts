import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<{ id: number; name: string; created_at: string }>(
      `SELECT id, name, created_at FROM watched_authors ORDER BY name ASC`
    );
    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Author name is required" }, { status: 400 });
    }
    const rows = await query<{ id: number; name: string; created_at: string }>(
      `INSERT INTO watched_authors (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, created_at`,
      [name.trim()]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
