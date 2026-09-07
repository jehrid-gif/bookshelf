import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import type { ReadingGoal } from "@/lib/types";

export const dynamic = "force-dynamic";

// One goal row per year. GET with no ?year returns the current year's goal
// (or null if none has been set yet) so the dashboard can ask for "this
// year's goal" without knowing what year it is client-side.
export async function GET(req: NextRequest) {
  try {
    const yearParam = req.nextUrl.searchParams.get("year");
    const year = yearParam ? Number(yearParam) : new Date().getFullYear();
    if (!Number.isInteger(year)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    const row = await queryOne<ReadingGoal>(
      `SELECT year, goal FROM reading_goals WHERE year = $1`,
      [year]
    );
    return NextResponse.json(row);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Upsert — setting a goal for a year that already has one just replaces it,
// so re-running "set my goal" from the dashboard is always safe.
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const year = Number(body.year);
    const goal = Number(body.goal);
    if (!Number.isInteger(year)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    if (!Number.isInteger(goal) || goal <= 0) {
      return NextResponse.json(
        { error: "Goal must be a positive whole number" },
        { status: 400 }
      );
    }
    const rows = await query<ReadingGoal>(
      `INSERT INTO reading_goals (year, goal) VALUES ($1, $2)
       ON CONFLICT (year) DO UPDATE SET goal = EXCLUDED.goal
       RETURNING year, goal`,
      [year, goal]
    );
    return NextResponse.json(rows[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
