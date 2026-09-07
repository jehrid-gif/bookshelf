"use client";

import { useEffect, useMemo, useState } from "react";
import BookDetail from "@/components/BookDetail";
import BookCover from "@/components/BookCover";
import { SkeletonLines } from "@/components/Skeleton";
import { computeSeriesStats, computeSeriesBinges } from "@/lib/seriesStats";
import type { Book } from "@/lib/types";
const BookDetailAny = BookDetail as any;

const STATUS_LABEL: Record<string, string> = {
  to_read: "To Read",
  reading: "Reading",
  finished: "Finished",
  wishlist: "Wishlist",
};

// Turns a day count into the roughest unit that still reads naturally —
// "3 years, 2 months" for a long series journey, "18 days" for a binge.
function formatDuration(days: number): string {
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30));
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30);
  const yearPart = `${years} year${years === 1 ? "" : "s"}`;
  return months > 0 ? `${yearPart}, ${months} month${months === 1 ? "" : "s"}` : yearPart;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function SeriesPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Book | null>(null);

  useEffect(() => {
    fetch("/api/books")
      .then((res) => res.json())
      .then((data) => setBooks(data as Book[]))
      .catch((err) => setError(err.message));
  }, []);

  const seriesStats = useMemo(() => (books ? computeSeriesStats(books) : []), [books]);
  const seriesBinges = useMemo(() => (books ? computeSeriesBinges(books) : []), [books]);

  function applySaved(updated: Book) {
    setBooks((prev) =>
      prev ? prev.map((b) => (b.trello_id === updated.trello_id ? updated : b)) : prev
    );
  }

  function handleDeleted(id: string) {
    setBooks((prev) => (prev ? prev.filter((b) => b.trello_id !== id) : prev));
    setViewing(null);
  }

  function handleReadAgain(created: Book) {
    setBooks((prev) => (prev ? [created, ...prev] : [created]));
    setViewing(null);
  }

  if (error) {
    return <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>;
  }

  if (!books) {
    return <SkeletonLines />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-ink">Series</h1>
      <p className="text-sm text-stone-500">
        Every series with at least 2 books logged, sorted by what you're reading now,
        then what's closest to finished.
      </p>

      {seriesBinges.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-ink mb-1">🔥 Series Binges</h2>
          <p className="text-xs text-stone-500 mb-3">
            Series where you tore through multiple books back to back.
          </p>
          <ul className="space-y-1.5">
            {seriesBinges.slice(0, 5).map((binge) => (
              <li key={binge.series} className="text-sm text-stone-600">
                You blitzed through{" "}
                <span className="font-medium text-ink">
                  {binge.count} books of {binge.series}
                </span>{" "}
                in {formatDuration(binge.days)} ({formatDate(binge.startDate)} –{" "}
                {formatDate(binge.endDate)}).
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {seriesStats.map((s) => {
          const isOpen = expanded === s.series;
          return (
            <div key={s.series} className="card">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : s.series)}
                className="w-full text-left flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-ink">{s.series}</p>
                    {s.isActivelyReading && (
                      <span className="badge bg-amber-100 text-amber-800">reading</span>
                    )}
                    {s.percent === 100 && (
                      <span className="badge bg-emerald-50 text-emerald-800">complete</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    {s.finished} finished · {s.reading} reading · {s.toRead} to read
                    {s.wishlist > 0 && ` · ${s.wishlist} wishlist`}
                    {" · "}
                    {s.owned}/{s.tracked} owned
                  </p>
                  <div className="h-2 rounded-full bg-stone-100 overflow-hidden mt-2 max-w-xs">
                    <div
                      className="h-full bg-brass rounded-full"
                      style={{ width: `${s.percent}%` }}
                    />
                  </div>
                  {s.percent === 100 && s.journeyDays !== null && (
                    <p className="text-xs text-stone-500 mt-2">
                      📖 Finished the whole series in {formatDuration(s.journeyDays)} (
                      {formatDate(s.journeyStart!)} – {formatDate(s.journeyEnd!)})
                    </p>
                  )}
                </div>
                <p className="text-2xl font-bold text-ink flex-none">{s.percent}%</p>
              </button>

              {isOpen && (
                <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {s.books.map((b) => (
                    <button
                      key={b.trello_id}
                      type="button"
                      onClick={() => setViewing(b)}
                      className="text-left"
                      title={b.title}
                    >
                      <BookCover book={b} className="w-full aspect-[2/3]" />
                      <p className="text-[11px] text-stone-600 mt-1 line-clamp-2">
                        {b.series_index ? `#${b.series_index} — ` : ""}
                        {b.title}
                      </p>
                      <p className="text-[10px] text-stone-400">{STATUS_LABEL[b.status]}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {seriesStats.length === 0 && (
          <p className="text-stone-500">
            No series with 2 or more logged books yet.
          </p>
        )}
      </div>

      {viewing && (
        <BookDetailAny
          book={viewing}
          onClose={() => setViewing(null)}
          onSaved={applySaved}
          onDeleted={handleDeleted}
          onReadAgain={handleReadAgain}
        />
      )}
    </div>
  );
}
