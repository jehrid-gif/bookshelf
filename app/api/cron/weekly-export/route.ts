import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { Book } from "@/lib/types";
import { toCsv, type CsvColumn } from "@/lib/csv";
import { sendEmailWithAttachment } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STATUS_LABEL: Record<string, string> = {
  to_read: "To Read",
  reading: "Reading",
  finished: "Finished",
  wishlist: "Wishlist",
};

const COLUMNS: CsvColumn[] = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "series", label: "Series" },
  { key: "series_index", label: "Series #" },
  { key: "genre", label: "Genre" },
  { key: "status", label: "Status" },
  { key: "pages", label: "Pages" },
  { key: "my_rating", label: "Rating" },
  { key: "date_finished", label: "Date Finished" },
];

// Vercel Cron calls this directly (no rs_auth cookie), authenticating with a
// bearer token instead — same pattern as /api/cron/refresh-releases. Sends a
// CSV snapshot of the core reading-log fields to EXPORT_RECIPIENT_EMAIL via
// Resend every week (see vercel.json for the schedule).
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
    const books = await query<Book>(
      `SELECT * FROM books ORDER BY board_pos ASC, title ASC`
    );

    const rows = books.map((b) => ({
      title: b.title,
      author: b.author ?? "",
      series: b.series ?? "",
      series_index: b.series_index ?? "",
      genre: b.genre ?? "",
      status: STATUS_LABEL[b.status] ?? b.status,
      pages: b.pages ?? "",
      my_rating: b.my_rating ?? "",
      date_finished: b.date_finished ? b.date_finished.slice(0, 10) : "",
    }));

    const csv = toCsv(rows, COLUMNS);
    const date = new Date().toISOString().slice(0, 10);

    await sendEmailWithAttachment({
      to: recipient,
      from: "The Reading Shelf <onboarding@resend.dev>",
      subject: `Your Reading Shelf export — ${date}`,
      text: `Attached: your weekly reading-log export (${books.length} books) as of ${date}.`,
      filename: `reading-shelf-${date}.csv`,
      content: csv,
    });

    return NextResponse.json({ sent: true, count: books.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
