import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const CONFIRM_PHRASE = "DELETE ALL BOOKS";

// Debug-page tool: permanently deletes every book. Gated on an exact typed
// confirmation phrase checked server-side (not just in the UI) so a stray
// or malformed request can't trigger it by accident.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON" }, { status: 400 });
  }

  if (body?.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: `You must pass confirm: "${CONFIRM_PHRASE}" to wipe the library.` },
      { status: 400 }
    );
  }

  try {
    const deleted = await query(`DELETE FROM books RETURNING trello_id`);
    return NextResponse.json({ deleted: deleted.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
