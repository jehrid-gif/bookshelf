import { NextResponse } from "next/server";
import { getBooksBackupJson } from "@/lib/booksBackup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { json } = await getBooksBackupJson();
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
