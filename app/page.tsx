import Link from "next/link";
import { query } from "@/lib/db";
import type { Book } from "@/lib/types";
import { isIncomplete } from "@/lib/types";
import { computeReadNext, computeCurrentlyReading } from "@/lib/readNext";
import RandomPickButton from "@/components/RandomPickButton";
import WarhammerButton from "@/components/WarhammerButton";
import ExportButton from "@/components/ExportButton";
import DashboardBookLists from "@/components/DashboardBookLists";
import GenreTrendChart from "@/components/GenreTrendChart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const books = await query<Book>(`SELECT * FROM books`);

  const toRead = books.filter((b) => b.status === "to_read");
  const readNext = computeReadNext(books);
  const currentlyReading = computeCurrentlyReading(books);
  const incomplete = books.filter(isIncomplete);
  const uncheckedForCovers = books.filter((b) => !b.enrichment_status).length;
  const finished = books.filter((b) => b.status === "finished");
  const owned = books.filter((b) => b.owned);
  const wishlist = books.filter((b) => b.status === "wishlist");

  const currentYear = new Date().getFullYear();
  const finishedThisYear = finished.filter(
    (b) => b.date_finished && new Date(b.date_finished).getFullYear() === currentYear
  );
  const pagesThisYear = finishedThisYear.reduce((sum, b) => sum + (b.pages || 0), 0);
  const rated = finished.filter((b) => typeof b.my_rating === "number");
  const avgRating = rated.length
    ? rated.reduce((sum, b) => sum + (b.my_rating || 0), 0) / rated.length
    : null;

  const stats = {
    total: books.length,
    finished: finished.length,
    reading: books.filter((b) => b.status === "reading").length,
    toRead: toRead.length,
    wishlist: wishlist.length,
  };

  // Physical / Digital / All completion percentages
  const physical = books.filter((b) => b.format === "physical" || b.format === "physical+ebook");
  const digital = books.filter((b) => b.format === "ebook" || b.format === "physical+ebook");
  const formatBreakdown = [
    { label: "Physical", ...pct(physical) },
    { label: "Digital", ...pct(digital) },
    { label: "All Books", ...pct(books) },
  ];
  function pct(list: Book[]) {
    const done = list.filter((b) => b.status === "finished").length;
    return { done, total: list.length, percent: list.length ? Math.round((done / list.length) * 100) : 0 };
  }

  const currentlyReadingEntries = Array.from(currentlyReading.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-ink">Dashboard</h1>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile label="Total Books" value={stats.total} href="/library" />
        <StatTile label="Finished" value={stats.finished} href="/library?status=finished" />
        <StatTile label="Reading" value={stats.reading} href="/library?status=reading" />
        <StatTile label="To Read" value={stats.toRead} href="/library?status=to_read" />
        <StatTile label="Wishlist" value={stats.wishlist} href="/library?status=wishlist" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 border border-stone-200 rounded-lg overflow-hidden bg-white">
        <LedgerCell value={owned.length} label="Owned" />
        <LedgerCell value={finishedThisYear.length} label={`Finished ${currentYear}`} />
        <LedgerCell value={pagesThisYear.toLocaleString()} label={`Pages ${currentYear}`} />
        <LedgerCell value={avgRating ? `${avgRating.toFixed(1)}★` : "—"} label="Avg Rating" />
      </div>

      {incomplete.length > 0 && (
        <Link
          href="/library?incomplete=1"
          className="block card border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors"
        >
          <p className="text-amber-900 font-medium">
            ⚠️ {incomplete.length} book{incomplete.length === 1 ? "" : "s"} missing a genre or
            page count — click to fill in the next one
          </p>
        </Link>
      )}

      {uncheckedForCovers > 0 && (
        <Link
          href="/library"
          className="block card border-sky-200 bg-sky-50 hover:bg-sky-100 transition-colors"
        >
          <p className="text-sky-900 font-medium">
            🔍 {uncheckedForCovers} book{uncheckedForCovers === 1 ? "" : "s"} haven't been
            checked against Google Books for cover art, descriptions, and ISBNs yet — click to
            run it
          </p>
        </Link>
      )}

      <div className="card">
        <h2 className="font-semibold text-ink mb-3">📚 Completion by Format</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {formatBreakdown.map((f) => (
            <div key={f.label}>
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-sm font-medium text-ink">{f.label}</p>
                <p className="text-xs text-stone-500">
                  {f.percent}% · {f.done}/{f.total}
                </p>
              </div>
              <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full bg-brass rounded-full"
                  style={{ width: `${f.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <DashboardBookLists readNext={readNext} currentlyReading={currentlyReadingEntries} />

      <div className="card">
        <h2 className="font-semibold text-ink mb-1">📈 Genre Trends</h2>
        <p className="text-xs text-stone-500 mb-4">Books finished per year, by genre.</p>
        <GenreTrendChart books={books} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RandomPickButton />
        <WarhammerButton />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/year-in-review" className="btn btn-secondary">
          📅 Year in Review
        </Link>
        <Link href="/releases" className="btn btn-secondary">
          🔮 Upcoming Releases
        </Link>
        <Link href="/physical-todo" className="btn btn-secondary">
          📦 Physical Books What Need Readin'
        </Link>
        <Link href="/special-editions" className="btn btn-secondary">
          ✨ Special Editions
        </Link>
        <Link href="/duplicates" className="btn btn-secondary">
          🔁 Duplicates
        </Link>
        <ExportButton />
      </div>
    </div>
  );
}

function StatTile({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card text-center hover:bg-parchment/60 transition-colors block">
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
    </Link>
  );
}

function LedgerCell({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="px-4 py-3 border-r border-b sm:border-b-0 border-stone-200 last:border-r-0">
      <p className="text-lg font-semibold text-ink font-mono tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-stone-500 mt-0.5">{label}</p>
    </div>
  );
}
