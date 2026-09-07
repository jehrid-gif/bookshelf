"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BookDetail from "@/components/BookDetail";
import MonthlyGenreChart from "@/components/MonthlyGenreChart";
import { SkeletonLines } from "@/components/Skeleton";
import type { Book } from "@/lib/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const GENRE_COLORS: Record<string, string> = {
  Fantasy: "#2a78d6",
  "Science Fiction": "#eb6834",
  Horror: "#1baf7a",
  "Thriller/Mystery/Crime": "#eda100",
  "Historical/Literary Fiction": "#e87ba4",
  Nonfiction: "#008300",
};
const UNCLASSIFIED_COLOR = "#c3c2b7";
function colorFor(g: string) {
  return GENRE_COLORS[g] || UNCLASSIFIED_COLOR;
}

interface YearStats {
  year: string;
  books: Book[];
  total: number;
  pages: number;
  avgRating: number | null;
  genreCounts: Record<string, number>;
  topGenre: string | null;
}

function buildYearStats(books: Book[]): YearStats[] {
  const byYear = new Map<string, Book[]>();
  for (const b of books) {
    if (b.status !== "finished" || !b.date_finished) continue;
    const year = new Date(b.date_finished).getFullYear().toString();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(b);
  }
  return Array.from(byYear.entries())
    .map(([year, yearBooks]) => {
      const pages = yearBooks.reduce((sum, b) => sum + (b.pages || 0), 0);
      const rated = yearBooks.filter((b) => typeof b.my_rating === "number");
      const avgRating = rated.length
        ? rated.reduce((sum, b) => sum + (b.my_rating || 0), 0) / rated.length
        : null;
      const genreCounts: Record<string, number> = {};
      for (const b of yearBooks) {
        const g = b.genre || "Unclassified";
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
      const topGenre =
        Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      return { year, books: yearBooks, total: yearBooks.length, pages, avgRating, genreCounts, topGenre };
    })
    .sort((a, b) => Number(b.year) - Number(a.year));
}

function YearInReviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Book | null>(null);

  useEffect(() => {
    fetch("/api/books")
      .then((res) => res.json())
      .then((data) => setBooks(data as Book[]))
      .catch((err) => setError(err.message));
  }, []);

  const yearStats = useMemo(() => (books ? buildYearStats(books) : []), [books]);

  const selectedYear = searchParams.get("year");
  const selected = yearStats.find((y) => y.year === selectedYear) || null;

  function applySaved(updated: Book) {
    setBooks((prev) =>
      prev ? prev.map((b) => (b.trello_id === updated.trello_id ? updated : b)) : prev
    );
  }

  function handleDeleted(id: string) {
    setBooks((prev) => (prev ? prev.filter((b) => b.trello_id !== id) : prev));
    setViewing(null);
  }

  if (error) {
    return <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>;
  }

  if (!books) {
    return <SkeletonLines />;
  }

  if (selected) {
    const months = new Map<number, Book[]>();
    for (const b of selected.books) {
      const m = new Date(b.date_finished!).getMonth();
      if (!months.has(m)) months.set(m, []);
      months.get(m)!.push(b);
    }
    const monthEntries = Array.from(months.entries()).sort((a, b) => b[0] - a[0]);
    for (const [, list] of monthEntries) {
      list.sort(
        (a, b) => new Date(b.date_finished!).getTime() - new Date(a.date_finished!).getTime()
      );
    }
    const genreEntries = Object.entries(selected.genreCounts).sort((a, b) => b[1] - a[1]);

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink">{selected.year} in Review</h1>
          <Link href="/year-in-review" className="text-sm text-brass hover:underline">
            ← All years
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-ink">{selected.total}</p>
            <p className="text-xs uppercase tracking-wide text-stone-500">Books Read</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-ink">{selected.pages.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-wide text-stone-500">Pages Read</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-ink">
              {selected.avgRating ? `${selected.avgRating.toFixed(1)}★` : "—"}
            </p>
            <p className="text-xs uppercase tracking-wide text-stone-500">Avg Rating</p>
          </div>
          <div className="card text-center">
            <p className="text-lg font-bold text-ink leading-tight mt-1">
              {selected.topGenre || "—"}
            </p>
            <p className="text-xs uppercase tracking-wide text-stone-500">Top Genre</p>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-ink mb-3">Genre Breakdown</h2>
          <div className="h-4 rounded-full overflow-hidden flex w-full bg-stone-100">
            {genreEntries.map(([g, count]) => (
              <div
                key={g}
                style={{ width: `${(count / selected.total) * 100}%`, background: colorFor(g) }}
                title={`${g}: ${count}`}
                className="h-full border-r-2 border-surface last:border-r-0"
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs">
            {genreEntries.map(([g, count]) => (
              <span key={g} className="flex items-center gap-1.5 text-stone-600">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm flex-none"
                  style={{ background: colorFor(g) }}
                />
                {g} ({count})
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-ink mb-1">Genre Trends</h2>
          <p className="text-xs text-stone-500 mb-4">
            What you were reading, month by month, in {selected.year}.
          </p>
          <MonthlyGenreChart books={selected.books} />
        </div>

        <div className="space-y-5">
          {monthEntries.map(([m, list]) => (
            <div key={m}>
              <h3 className="font-serif font-semibold text-sm text-stone-500 mb-2 pb-1 border-b border-stone-200">
                {MONTH_NAMES[m]}
              </h3>
              <ul className="space-y-1.5">
                {list.map((b) => (
                  <li key={b.trello_id}>
                    <button
                      onClick={() => setViewing(b)}
                      className="w-full text-left text-sm rounded-md border border-stone-200 bg-surface px-3 py-2 hover:bg-parchment/60 hover:border-stone-300 transition-colors flex items-center justify-between gap-2"
                    >
                      <span>
                        <span className="font-medium text-ink">{b.title}</span>
                        {b.author && <span className="text-stone-500"> — {b.author}</span>}
                      </span>
                      {b.my_rating && (
                        <span className="text-amber-600 flex-none text-xs">
                          {"★".repeat(b.my_rating)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {viewing && (
          <BookDetail
            book={viewing}
            onClose={() => setViewing(null)}
            onSaved={applySaved}
            onDeleted={handleDeleted}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-ink">Year in Review</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {yearStats.map((y) => (
          <button
            key={y.year}
            onClick={() => router.push(`/year-in-review?year=${y.year}`)}
            className="card text-left hover:bg-parchment/60 transition-colors"
          >
            <p className="text-4xl font-bold text-ink leading-none">{y.year}</p>
            <p className="text-sm text-stone-500 mt-1.5">{y.total} books</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {y.topGenre && (
                <span className="badge bg-stone-100 text-stone-700">{y.topGenre}</span>
              )}
              {y.avgRating && (
                <span className="badge bg-amber-50 text-amber-800">
                  {y.avgRating.toFixed(1)}★ avg
                </span>
              )}
              <span className="badge bg-stone-100 text-stone-700">
                {y.pages.toLocaleString()}pg
              </span>
            </div>
          </button>
        ))}
        {yearStats.length === 0 && (
          <p className="text-stone-500 col-span-full">
            No finished books with a finish date yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default function YearInReviewPage() {
  return (
    <Suspense fallback={<SkeletonLines />}>
      <YearInReviewInner />
    </Suspense>
  );
}
