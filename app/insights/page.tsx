"use client";

import { useEffect, useMemo, useState } from "react";
import BookDetail from "@/components/BookDetail";
import BookCover from "@/components/BookCover";
import { SkeletonLines } from "@/components/Skeleton";
import type { Book, LengthCategory } from "@/lib/types";
import { LENGTH_CATEGORIES } from "@/lib/types";
const BookDetailAny = BookDetail as any;

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

interface ReadExtreme {
  book: Book;
  days: number;
}

// All-time fastest/slowest reads, pooled across every finished book with
// both a start and finish date (rereads included — a reread's speed is its
// own real data point).
function computeAllTimeExtremes(books: Book[]): {
  fastest: ReadExtreme | null;
  slowest: ReadExtreme | null;
} {
  const timed = books.filter((b) => b.status === "finished" && b.date_started && b.date_finished);
  const withDays: ReadExtreme[] = timed.map((b) => ({
    book: b,
    days: Math.round(
      (new Date(b.date_finished!).getTime() - new Date(b.date_started!).getTime()) / 86400000
    ),
  }));
  if (!withDays.length) return { fastest: null, slowest: null };
  return {
    fastest: withDays.reduce((min, cur) => (cur.days < min.days ? cur : min)),
    slowest: withDays.reduce((max, cur) => (cur.days > max.days ? cur : max)),
  };
}

interface LengthExtreme {
  book: Book;
  pages: number;
}

// All-time longest/shortest reads by page count. Excludes rereads — a
// reread of the same book has the same page count, so it wouldn't surface
// anything new, just duplicate an already-known record.
function computeAllTimeLengthExtremes(books: Book[]): {
  longest: LengthExtreme | null;
  shortest: LengthExtreme | null;
} {
  const withPages: LengthExtreme[] = books
    .filter((b) => b.status === "finished" && !b.is_reread && b.pages)
    .map((b) => ({ book: b, pages: b.pages! }));
  if (!withPages.length) return { longest: null, shortest: null };
  return {
    longest: withPages.reduce((max, cur) => (cur.pages > max.pages ? cur : max)),
    shortest: withPages.reduce((min, cur) => (cur.pages < min.pages ? cur : min)),
  };
}

// Quick/Medium/Long/Epic distribution across every finished book (rereads
// excluded, matching the length extremes above), in fixed shortest-to-
// longest order regardless of which categories you actually have data for.
function buildLengthBreakdown(books: Book[]): { category: LengthCategory; count: number }[] {
  const counts: Record<LengthCategory, number> = { Quick: 0, Medium: 0, Long: 0, Epic: 0 };
  for (const b of books) {
    if (b.status !== "finished" || b.is_reread || !b.length_category) continue;
    counts[b.length_category]++;
  }
  return LENGTH_CATEGORIES.map((category) => ({ category, count: counts[category] }));
}

// Volume-based — plain finish count, unlike the rating-based Authors
// ranking below. An author you've read 8 books by but never rated 5 stars
// still shows up here as someone you clearly can't put down.
function buildMostReadAuthors(books: Book[]): { name: string; count: number }[] {
  const finished = books.filter((b) => b.status === "finished" && !b.is_reread && b.author);
  const counts = new Map<string, number>();
  for (const b of finished) {
    counts.set(b.author!, (counts.get(b.author!) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

interface RereadStats {
  totalRereads: number;
  mostRereadTitle: string | null;
  mostRereadCount: number;
}

// Groups reread copies by their root book (original_id, flattened) to find
// which book/chain has been revisited the most.
function computeRereadStats(books: Book[]): RereadStats {
  const rereads = books.filter((b) => b.is_reread);
  const counts = new Map<string, { title: string; count: number }>();
  for (const b of rereads) {
    const rootId = b.original_id || b.trello_id;
    const existing = counts.get(rootId);
    if (existing) {
      existing.count++;
    } else {
      counts.set(rootId, { title: b.title, count: 1 });
    }
  }
  let mostRereadTitle: string | null = null;
  let mostRereadCount = 0;
  for (const { title, count } of counts.values()) {
    if (count > mostRereadCount) {
      mostRereadCount = count;
      mostRereadTitle = title;
    }
  }
  return { totalRereads: rereads.length, mostRereadTitle, mostRereadCount };
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

interface YearOverYear {
  books: { now: number; prev: number };
  pages: { now: number; prev: number };
  avgRating: { now: number | null; prev: number | null };
}

// This year vs last year on the same three headline numbers, so this
// year's pace has something to sit next to instead of floating in
// isolation.
function computeYearOverYear(books: Book[]): { currentYear: number; lastYear: number; data: YearOverYear } {
  const currentYear = new Date().getFullYear();
  const lastYear = currentYear - 1;
  const finished = books.filter((b) => b.status === "finished");

  const finishedThisYear = finished.filter(
    (b) => b.date_finished && new Date(b.date_finished).getFullYear() === currentYear
  );
  const finishedLastYear = finished.filter(
    (b) => b.date_finished && new Date(b.date_finished).getFullYear() === lastYear
  );
  const pagesThisYear = finishedThisYear.reduce((sum, b) => sum + (b.pages || 0), 0);
  const pagesLastYear = finishedLastYear.reduce((sum, b) => sum + (b.pages || 0), 0);
  const rated = finishedThisYear.filter((b) => typeof b.my_rating === "number");
  const avgRating = rated.length
    ? rated.reduce((sum, b) => sum + (b.my_rating || 0), 0) / rated.length
    : null;
  const ratedLastYear = finishedLastYear.filter((b) => typeof b.my_rating === "number");
  const avgRatingLastYear = ratedLastYear.length
    ? ratedLastYear.reduce((sum, b) => sum + (b.my_rating || 0), 0) / ratedLastYear.length
    : null;

  return {
    currentYear,
    lastYear,
    data: {
      books: { now: finishedThisYear.length, prev: finishedLastYear.length },
      pages: { now: pagesThisYear, prev: pagesLastYear },
      avgRating: { now: avgRating, prev: avgRatingLastYear },
    },
  };
}

// Highly-rated finishes that haven't been touched in a while (updated_at is
// the closest proxy we have to "last looked at"), as a gentle nudge to
// revisit an old favorite.
function buildForgottenFavorites(books: Book[]): Book[] {
  return books
    .filter(
      (b) => b.status === "finished" && !b.is_reread && typeof b.my_rating === "number" && b.my_rating >= 4
    )
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
    .slice(0, 3);
}

export default function InsightsPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Book | null>(null);

  useEffect(() => {
    fetch("/api/books")
      .then((res) => res.json())
      .then((data) => setBooks(data as Book[]))
      .catch((err) => setError(err.message));
  }, []);

  const { byGenre, byAuthor } = useMemo(() => buildRatingBreakdowns(books || []), [books]);
  const byMood = useMemo(() => buildTagRatingBreakdown(books || [], "moods"), [books]);
  const byWorld = useMemo(() => buildTagRatingBreakdown(books || [], "worlds"), [books]);
  const ratingDistribution = useMemo(() => buildRatingDistribution(books || []), [books]);
  const formatTrends = useMemo(() => buildFormatTrends(books || []), [books]);
  const seasonalPattern = useMemo(() => buildSeasonalPattern(books || []), [books]);
  const allTimeExtremes = useMemo(() => computeAllTimeExtremes(books || []), [books]);
  const allTimeLengthExtremes = useMemo(
    () => computeAllTimeLengthExtremes(books || []),
    [books]
  );
  const lengthBreakdown = useMemo(() => buildLengthBreakdown(books || []), [books]);
  const mostReadAuthors = useMemo(() => buildMostReadAuthors(books || []), [books]);
  const rereadStats = useMemo(() => computeRereadStats(books || []), [books]);
  const yoy = useMemo(() => computeYearOverYear(books || []), [books]);
  const forgottenFavorites = useMemo(() => buildForgottenFavorites(books || []), [books]);

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
      <h1 className="text-xl font-bold text-ink">Insights</h1>
      <p className="text-sm text-stone-500">
        Stats and patterns across your whole library, not tied to any one year.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-semibold text-ink mb-3">
            📈 {yoy.currentYear} vs {yoy.lastYear}
          </h2>
          <div className="space-y-2.5">
            <YoyRow label="Books" now={yoy.data.books.now} prev={yoy.data.books.prev} />
            <YoyRow
              label="Pages"
              now={yoy.data.pages.now}
              prev={yoy.data.pages.prev}
              format="pages"
            />
            <YoyRow
              label="Avg Rating"
              now={yoy.data.avgRating.now}
              prev={yoy.data.avgRating.prev}
              format="rating"
            />
          </div>
        </div>

        {forgottenFavorites.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-ink mb-1">💭 Forgotten Favorites</h2>
            <p className="text-xs text-stone-500 mb-3">
              Books you rated highly a while back — maybe it's time for a reread.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {forgottenFavorites.map((b) => (
                <button
                  key={b.trello_id}
                  type="button"
                  onClick={() => setViewing(b)}
                  className="text-left"
                  title={b.title}
                >
                  <BookCover book={b} className="w-full aspect-[2/3]" />
                  <p className="text-[11px] text-stone-600 mt-1 line-clamp-2">{b.title}</p>
                  <p className="text-amber-600 text-xs">{"★".repeat(b.my_rating!)}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {(allTimeExtremes.fastest || allTimeExtremes.slowest) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {allTimeExtremes.fastest && (
            <button
              type="button"
              onClick={() => setViewing(allTimeExtremes.fastest!.book)}
              className="card text-left hover:bg-parchment/60 transition-colors flex items-center gap-3"
            >
              <BookCover book={allTimeExtremes.fastest.book} className="w-12 h-16 flex-none" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  ⚡ Fastest Read (All-Time)
                </p>
                <p className="font-medium text-ink truncate">
                  {allTimeExtremes.fastest.book.title}
                </p>
                <p className="text-sm text-stone-500">
                  {allTimeExtremes.fastest.days} day{allTimeExtremes.fastest.days === 1 ? "" : "s"}
                </p>
              </div>
            </button>
          )}
          {allTimeExtremes.slowest && (
            <button
              type="button"
              onClick={() => setViewing(allTimeExtremes.slowest!.book)}
              className="card text-left hover:bg-parchment/60 transition-colors flex items-center gap-3"
            >
              <BookCover book={allTimeExtremes.slowest.book} className="w-12 h-16 flex-none" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  🐢 Slowest Read (All-Time)
                </p>
                <p className="font-medium text-ink truncate">
                  {allTimeExtremes.slowest.book.title}
                </p>
                <p className="text-sm text-stone-500">
                  {allTimeExtremes.slowest.days} day{allTimeExtremes.slowest.days === 1 ? "" : "s"}
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {(allTimeLengthExtremes.longest || allTimeLengthExtremes.shortest) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {allTimeLengthExtremes.longest && (
            <button
              type="button"
              onClick={() => setViewing(allTimeLengthExtremes.longest!.book)}
              className="card text-left hover:bg-parchment/60 transition-colors flex items-center gap-3"
            >
              <BookCover book={allTimeLengthExtremes.longest.book} className="w-12 h-16 flex-none" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  📚 Longest Read (All-Time)
                </p>
                <p className="font-medium text-ink truncate">
                  {allTimeLengthExtremes.longest.book.title}
                </p>
                <p className="text-sm text-stone-500">
                  {allTimeLengthExtremes.longest.pages.toLocaleString()} pages
                </p>
              </div>
            </button>
          )}
          {allTimeLengthExtremes.shortest && (
            <button
              type="button"
              onClick={() => setViewing(allTimeLengthExtremes.shortest!.book)}
              className="card text-left hover:bg-parchment/60 transition-colors flex items-center gap-3"
            >
              <BookCover book={allTimeLengthExtremes.shortest.book} className="w-12 h-16 flex-none" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-stone-500">
                  📄 Shortest Read (All-Time)
                </p>
                <p className="font-medium text-ink truncate">
                  {allTimeLengthExtremes.shortest.book.title}
                </p>
                <p className="text-sm text-stone-500">
                  {allTimeLengthExtremes.shortest.pages.toLocaleString()} pages
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {(mostReadAuthors.length > 0 || rereadStats.totalRereads > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {mostReadAuthors.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-ink mb-1">Most-Read Authors</h2>
              <p className="text-xs text-stone-500 mb-3">
                By finish count, not rating — who you keep coming back to.
              </p>
              <ul className="space-y-1.5">
                {mostReadAuthors.map((a) => (
                  <li key={a.name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink truncate">{a.name}</span>
                    <span className="text-stone-500 flex-none text-xs font-medium">
                      {a.count} book{a.count === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rereadStats.totalRereads > 0 && (
            <div className="card">
              <h2 className="font-semibold text-ink mb-3">💭 Comfort Rereads</h2>
              <p className="text-2xl font-bold text-ink">{rereadStats.totalRereads}</p>
              <p className="text-xs uppercase tracking-wide text-stone-500 mb-3">
                Total Times Reread
              </p>
              {rereadStats.mostRereadTitle && rereadStats.mostRereadCount >= 2 && (
                <p className="text-sm text-stone-600">
                  Most reread:{" "}
                  <span className="font-medium text-ink">{rereadStats.mostRereadTitle}</span> (
                  {rereadStats.mostRereadCount}×)
                </p>
              )}
            </div>
          )}
        </div>
      )}

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

      {lengthBreakdown.some((l) => l.count > 0) && (
        <div className="card">
          <h2 className="font-semibold text-ink mb-1">Book Length Breakdown</h2>
          <p className="text-xs text-stone-500 mb-3">
            Quick (under 250pg) to Epic (600pg+), across every book you've finished.
          </p>
          <div className="space-y-2">
            {lengthBreakdown.map((l) => {
              const max = Math.max(...lengthBreakdown.map((x) => x.count), 1);
              return (
                <div key={l.category} className="flex items-center gap-2 text-sm">
                  <span className="w-16 text-stone-600 flex-none">{l.category}</span>
                  <div className="flex-1 h-3 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className="h-full bg-brass rounded-full"
                      style={{ width: `${(l.count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-stone-500 text-xs flex-none">
                    {l.count}
                  </span>
                </div>
              );
            })}
          </div>
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

function YoyRow({
  label,
  now,
  prev,
  format,
}: {
  label: string;
  now: number | null;
  prev: number | null;
  format?: "pages" | "rating";
}) {
  function fmt(v: number | null): string {
    if (v === null) return "—";
    if (format === "pages") return v.toLocaleString();
    if (format === "rating") return `${v.toFixed(1)}★`;
    return String(v);
  }
  const delta = now !== null && prev !== null ? now - prev : null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-stone-600">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-medium text-ink">{fmt(now)}</span>
        <span className="text-stone-400 text-xs">vs {fmt(prev)}</span>
        {delta !== null && delta !== 0 && (
          <span className={delta > 0 ? "text-emerald-600 text-xs" : "text-red-500 text-xs"}>
            {delta > 0 ? "▲" : "▼"}{" "}
            {format === "rating" ? Math.abs(delta).toFixed(1) : Math.abs(delta).toLocaleString()}
          </span>
        )}
      </span>
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
