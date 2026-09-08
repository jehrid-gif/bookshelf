import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

interface LayoutRow {
  section_order: string[];
}

// Cross-device layout memory for reorderable panels (Insights page,
// Milestones panel) — one row per panel, keyed by a short slug like
// "insights" or "milestones". Stored in Postgres rather than localStorage,
// the same reasoning as the taste-match snapshot, so a reorder made on one
// device is there on every other device too.
export async function GET(_req: NextRequest, { params }: { params: { panel: string } }) {
  try {
    const row = await queryOne<LayoutRow>(
      `SELECT section_order FROM panel_layout WHERE panel = $1`,
      [params.panel]
    );
    return NextResponse.json({ order: row?.section_order ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { panel: string } }) {
  try {
    const body = await req.json();
    const order = Array.isArray(body?.order) ? body.order : null;
    if (!order || !order.every((id: unknown) => typeof id === "string")) {
      return NextResponse.json(
        { error: "Body must include an `order` array of strings" },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO panel_layout (panel, section_order, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (panel) DO UPDATE SET section_order = $2::jsonb, updated_at = now()`,
      [params.panel, JSON.stringify(order)]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
