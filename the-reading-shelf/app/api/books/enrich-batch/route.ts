import { NextRequest, NextResponse } from "next/server";
import { runEnrichmentBatch } from "@/lib/enrichment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let limit = 40;
    try {
      const body = await req.json();
      if (body?.limit) limit = Math.min(Math.max(parseInt(body.limit, 10) || 40, 1), 100);
    } catch {
      // no body — use default
    }
    const result = await runEnrichmentBatch(limit);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
