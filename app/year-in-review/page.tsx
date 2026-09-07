"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import BookDetail from "@/components/BookDetail";
import BookCover from "@/components/BookCover";
import MonthlyGenreChart from "@/components/MonthlyGenreChart";
import { SkeletonLines } from "@/components/Skeleton";
import type { Book } from "@/lib/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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
  avgDaysToFinish: number | null;
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
      const timed = yearBooks.filter((b) => b.date_started && b.date_finished);
      const avgDaysToFinish = timed.length
        ? Math.round(
            timed.reduce(
              (sum, b) =>
                sum +
                (new Date(b.date_finished!).getTime() - new Date(b.date_started!).getTime()) /
                  86400000,
              0
            ) / timed.length
          )
        : null;
      const genreCounts: Record<string, number> = {};
      for (const b of yearBooks) {
        const g = b.genre || "Unclassified";
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
      const topGenre =
        Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      return {
        year,
        books: yearBooks,
        total: yearBooks.length,
        pages,
        avgRating,
        avgDaysToFinish,
        genreCounts,
        topGenre,
      };
    })
    .sort((a, b) => Number(b.year) - Number(a.year));
}

interface RatingBreakdown {
  name: string;
  avg: number;
  count: number;
}

// Only genres/authors with at least 2 rated books get ranked — a single
// 5-star fluke shouldn't crown someone's "best author of all time."
function buildRatingBreakdowns(books: Book[]): {
  byGenre: RatingBreakdown[];
  byAuthor: RatingBreakdown[];
} {
  const rated = books.filter(
    (b) => b.status === "finished" && typeof b.my_rating === "number" && !b.is_reread
  );

  function rank(keyFn: (b: Book) => string | null): RatingBreakdown[] {
    const buckets = new Map<string, number[]>();
    for (const b of rated) {
      const key = keyFn(b);
      if (!key) continue;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(b.my_rating!);
    }
    return Array.from(buckets.entries())
      .filter(([, ratings]) => ratings.length >= 2)
      .map(([name, ratings]) => ({
        name,
        avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
        count: ratings.length,
      }))
      .sort((a, b) => b.avg - a.avg || b.count - a.count);
  }

  return {
    byGenre: rank((b) => b.genre),
    byAuthor: rank((b) => b.author),
  };
}

// Moods/worlds are multi-valued tags per book, so a single book can feed
// several buckets at once — unlike genre/author above, which pick one key
// per book. Same "at least 2 rated" floor applies.
function buildTagRatingBreakdown(books: Book[], field: "moods" | "worlds"): RatingBreakdown[] {
  const rated = books.filter(
    (b) => b.status === "finished" && typeof b.my_rating === "number" && !b.is_reread
  );
  const buckets = new Map<string, number[]>();
  for (const b of rated) {
    const tags = field === "moods" ? b.moods : b.worlds;
    for (const tag of tags) {
      if (!buckets.has(tag)) buckets.set(tag, []);
      buckets.get(tag)!.push(b.my_rating!);
    }
  }
  return Array.from(buckets.entries())
    .filter(([, ratings]) => ratings.length >= 2)
    .map(([name, ratings]) => ({
      name,
      avg: ratings.reduce((a, b) => a + b, 0) / ratings.length,
      count: ratings.length,
    }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count);
}

// How many 1-5 star ratings you've given out, across every finished book
// (rereads included — a reread gets its own rating for its own read-through).
function buildRatingDistribution(books: Book[]): { rating: number; count: number }[] {
  const counts = [0, 0, 0, 0, 0];
  for (const b of books) {
    if (b.status !== "finished" || typeof b.my_rating !== "number") continue;
    if (b.my_rating >= 1 && b.my_rating <= 5) counts[b.my_rating - 1]++;
  }
  return counts.map((count, i) => ({ rating: i + 1, count }));
}

interface FormatTrend {
  year: string;
  physical: number;
  digital: number;
  total: number;
}

// Physical vs digital finishes per year, oldest first — a "format" counts
// toward both physical and digital if it's physical+ebook, matching the
// dashboard's Completion by Format convention.
function buildFormatTrends(books: Book[]): FormatTrend[] {
  const byYear = new Map<string, Book[]>();
  for (const b of books) {
    if (b.status !== "finished" || !b.date_finished) continue;
    const year = new Date(b.date_finished).getFullYear().toString();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(b);
  }
  return Array.from(byYear.entries())
    .map(([year, yearBooks]) => ({
      year,
      physical: yearBooks.filter((b) => b.format === "physical" || b.format === "physical+ebook")
        .length,
      digital: yearBooks.filter((b) => b.format === "ebook" || b.format === "physical+ebook")
        .length,
      total: yearBooks.length,
    }))
    .sort((a, b) => Number(a.year) - Number(b.year));
}

interface SeasonalPattern {
  month: number;
  topGenre: string | null;
  topCount: number;
  totalInMonth: number;
}

// Which genre shows up most for each calendar month, pooled across every
// year of history — "October is always Horror month" is a pattern you can
// only see once you've got a few years stacked on top of each other.
function buildSeasonalPattern(books: Book[]): SeasonalPattern[] {
  const monthGenre = new Map<number, Map<string, number>>();
  const monthTotal = new Map<number, number>();
  for (const b of books) {
    if (b.status !== "finished" || !b.date_finished) continue;
    const m = new Date(b.date_finished).getMonth();
    const g = b.genre || "Unclassified";
    if (!monthGenre.has(m)) monthGenre.set(m, new Map());
    const gm = monthGenre.get(m)!;
    gm.set(g, (gm.get(g) || 0) + 1);
    monthTotal.set(m, (monthTotal.get(m) || 0) + 1);
  }
  const result: SeasonalPattern[] = [];
  for (let m = 0; m < 12; m++) {
    const gm = monthGenre.get(m);
    const total = monthTotal.get(m) || 0;
    if (!gm || gm.size === 0) {
      result.push({ month: m, topGenre: null, topCount: 0, totalInMonth: total });
      continue;
    }
    const [topGenre, topCount] = Array.from(gm.entries()).sort((a, b) => b[1] - a[1])[0];
    result.push({ month: m, topGenre, topCount, totalInMonth: total });
  }
  return result;
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
  const { byGenre, byAuthor } = useMemo(
    () => buildRatingBreakdowns(books || []),
    [books]
  );
  const byMood = useMemo(() => buildTagRatingBreakdown(books || [], "moods"), [books]);
  const byWorld = useMemo(() => buildTagRatingBreakdown(books || [], "worlds"), [books]);
  const ratingDistribution = useMemo(() => buildRatingDistribution(books || []), [books]);
  const formatTrends = useMemo(() => buildFormatTrends(books || []), [books]);
  const seasonalPattern = useMemo(() => buildSeasonalPattern(books || []), [books]);

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
    const topBooks = [...selected.books]
      .filter((b) => typeof b.my_rating === "number")
      .sort(
        (a, b) =>
          (b.my_rating || 0) - (a.my_rating || 0) ||
          new Date(b.date_finished!).getTime() - new Date(a.date_finished!).getTime()
      )
      .slice(0, 5);

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink">{selected.year} in Review</h1>
          <Link href="/year-in-review" className="text-sm text-brass hover:underline">
            ← All years
          </Link>
        </div>

        <div className="card">
          <h2 className="font-semibold text-ink mb-3">Your {selected.year} Shelf</h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
            {selected.books.map((b) => (
              <button
                key={b.trello_id}
                type="button"
                onClick={() => setViewing(b)}
                className="text-left"
                title={b.title}
              >
                <BookCover book={b} className="w-full h-28" />
              </button>
            ))}
          </div>
        </div>

        {topBooks.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-ink mb-3">Top Books of {selected.year}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {topBooks.map((b) => (
                <button
                  key={b.trello_id}
                  type="button"
                  onClick={() => setViewing(b)}
                  className="text-left"
                  title={b.title}
                >
                  <BookCover book={b} className="w-full h-36" />
                  <p className="text-sm font-medium text-ink mt-1.5 line-clamp-2">{b.title}</p>
                  <p className="text-amber-600 text-xs mt-0.5">{"★".repeat(b.my_rating!)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
            <p className="text-2xl font-bold text-ink">
              {selected.avgDaysToFinish ?? "—"}
            </p>
            <p className="text-xs uppercase tracking-wide text-stone-500">Avg Days to Finish</p>
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

      {(byGenre.length > 0 || byAuthor.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {byGenre.length > 0 && (
            <RankedList
              title="Genres, by Avg Rating"
              subtitle="Genres with at least 2 rated books, best first."
              items={byGenre}
              dotColor={colorFor}
            />
          )}
          {byAuthor.length > 0 && (
            <RankedList
              title="Authors, by Avg Rating"
              subtitle="Authors with at least 2 rated books, best first."
              items={byAuthor}
              limit={10}
            />
          )}
        </div>
      )}

      {(byMood.length > 0 || byWorld.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {byMood.length > 0 && (
            <RankedList
              title="Moods, by Avg Rating"
              subtitle="Moods with at least 2 rated books, best first."
              items={byMood}
              limit={10}
            />
          )}
          {byWorld.length > 0 && (
            <RankedList
              title="Worlds, by Avg Rating"
              subtitle="Worlds with at least 2 rated books, best first."
              items={byWorld}
            />
          )}
        </div>
      )}

      {(ratingDistribution.some((r) => r.count > 0) || formatTrends.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {ratingDistribution.some((r) => r.count > 0) && (
            <div className="card">
              <h2 className="font-semibold text-ink mb-3">Star Rating Distribution</h2>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const entry = ratingDistribution.find((r) => r.rating === star)!;
                  const max = Math.max(...ratingDistribution.map((r) => r.count), 1);
                  return (
                    <div key={star} className="flex items-center gap-2 text-sm">
                      <span className="w-8 text-stone-600 flex-none">{star}★</span>
                      <div className="flex-1 h-3 rounded-full bg-stone-100 overflow-hidden">
                        <div
                          className="h-full bg-brass rounded-full"
                          style={{ width: `${(entry.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-stone-500 text-xs flex-none">
                        {entry.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {formatTrends.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-ink mb-3">Format Trends Over Time</h2>
              <div className="space-y-2.5">
                {formatTrends.map((f) => (
                  <div key={f.year}>
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span className="font-medium text-ink">{f.year}</span>
                      <span>
                        {f.physical} physical · {f.digital} digital
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden flex w-full bg-stone-100">
                      {f.physical + f.digital > 0 && (
                        <>
                          <div
                            className="h-full bg-brass"
                            style={{
                              width: `${(f.physical / (f.physical + f.digital)) * 100}%`,
                            }}
                            title={`Physical: ${f.physical}`}
                          />
                          <div
                            className="h-full bg-sky-400"
                            style={{
                              width: `${(f.digital / (f.physical + f.digital)) * 100}%`,
                            }}
                            title={`Digital: ${f.digital}`}
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brass" /> Physical
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-400" /> Digital
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {seasonalPattern.some((p) => p.totalInMonth >= 3) && (
        <div className="card">
          <h2 className="font-semibold text-ink mb-1">Seasonal Genre Pattern</h2>
          <p className="text-xs text-stone-500 mb-3">
            Your most-read genre for each month, pooled across every year.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {seasonalPattern.map((p) => {
              const hasPattern = p.totalInMonth >= 3 && p.topGenre;
              return (
                <div
                  key={p.month}
                  className="rounded-md border border-stone-200 p-2 text-center"
                  style={
                    hasPattern
                      ? {
                          borderColor: colorFor(p.topGenre!),
                          background: `${colorFor(p.topGenre!)}14`,
                        }
                      : undefined
                  }
                >
                  <p className="text-xs font-semibold text-ink">{MONTH_NAMES_SHORT[p.month]}</p>
                  <p className="text-[11px] text-stone-600 mt-1 leading-tight">
                    {hasPattern ? p.topGenre : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RankedList({
  title,
  subtitle,
  items,
  limit,
  dotColor,
}: {
  title: string;
  subtitle: string;
  items: RatingBreakdown[];
  limit?: number;
  dotColor?: (name: string) => string;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <div className="card">
      <h2 className="font-semibold text-ink mb-1">{title}</h2>
      <p className="text-xs text-stone-500 mb-3">{subtitle}</p>
      <ul className="space-y-1.5">
        {shown.map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 min-w-0">
              {dotColor && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm flex-none"
                  style={{ background: dotColor(item.name) }}
                />
              )}
              <span className="text-ink truncate">{item.name}</span>
              <span className="text-stone-400 flex-none text-xs">({item.count})</span>
            </span>
            <span className="text-amber-600 flex-none text-xs font-medium">
              {item.avg.toFixed(1)}★
            </span>
          </li>
        ))}
      </ul>
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
