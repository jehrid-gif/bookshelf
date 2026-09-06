import { NextRequest, NextResponse } from "next/server";
import { getBooksBackupJson } from "@/lib/booksBackup";
import { sendEmailWithAttachment } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Vercel Cron calls this directly (no rs_auth cookie), authenticating with a
// bearer token instead — same pattern as the other /api/cron routes. Sends
// the full, restorable JSON backup (identical to the Debug page's download)
// to EXPORT_RECIPIENT_EMAIL via Resend every week (see vercel.json for the
// schedule), so a working restore file always lands somewhere outside the
// database itself even if nobody remembers to download one by hand.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipient = process.env.EXPORT_RECIPIENT_EMAIL;
  if (!recipient) {
    return NextResponse.json(
      { error: "EXPORT_RECIPIENT_EMAIL is not configured" },
      { status: 500 }
    );
  }

  try {
    const { json, count } = await getBooksBackupJson();
    const date = new Date().toISOString().slice(0, 10);

    await sendEmailWithAttachment({
      to: recipient,
      from: "The Reading Shelf <onboarding@resend.dev>",
      subject: `Your Reading Shelf backup — ${date}`,
      text: `Attached: a full, restorable backup of your library (${count} books) as of ${date}. If you ever need to rebuild your library, upload this file on the Debug & Backup page's Restore section.`,
      filename: `reading-shelf-backup-${date}.json`,
      content: json,
    });

    return NextResponse.json({ sent: true, count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
