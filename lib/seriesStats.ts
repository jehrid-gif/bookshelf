import type { Book } from "./types";

export interface SeriesStat {
  series: string;
  finished: number;
  reading: number;
  toRead: number;
  wishlist: number;
  owned: number;
  // finished + reading + toRead — the "you actually have this" population,
  // matching the dashboard's trackedList convention (excludes wishlist and
  // reread copies so a series' completion isn't inflated by either).
  tracked: number;
  percent: number;
  isActivelyReading: boolean;
  books: Book[];
  // Only populated once a series is 100% finished — the span from the
  // earliest date_started to the latest date_finished across every book in
  // it, i.e. "how long did this whole series take you, start to finish."
  journeyDays: number | null;
  journeyStart: string | null;
  journeyEnd: string | null;
}

// Groups books by series (ignoring reread copies — a reread doesn't change
// how much of a series you own or have finished) and computes a completion
// percentage for every series with at least 2 logged entries. A series with
// only one book logged isn't really a "series" from a completion-tracking
// standpoint yet, so it's left out.
export function computeSeriesStats(books: Book[]): SeriesStat[] {
  const nonReread = books.filter((b) => !b.is_reread);
  const bySeries = new Map<string, Book[]>();
  for (const b of nonReread) {
    const s = (b.series || "").trim();
    if (!s) continue;
    if (!bySeries.has(s)) bySeries.set(s, []);
    bySeries.get(s)!.push(b);
  }

  const results: SeriesStat[] = [];
  for (const [series, entries] of bySeries) {
    if (entries.length < 2) continue;

    const tracked = entries.filter((b) => b.status !== "wishlist");
    const finished = tracked.filter((b) => b.status === "finished");
    const reading = tracked.filter((b) => b.status === "reading");
    const toRead = tracked.filter((b) => b.status === "to_read");
    const wishlist = entries.filter((b) => b.status === "wishlist");
    const owned = tracked.filter((b) => b.owned);
    const percent = tracked.length
      ? Math.round((finished.length / tracked.length) * 100)
      : 0;

    const sortedBooks = [...entries].sort(
      (a, b) =>
        (a.series_index ?? Infinity) - (b.series_index ?? Infinity) ||
        a.title.localeCompare(b.title)
    );

    let journeyDays: number | null = null;
    let journeyStart: string | null = null;
    let journeyEnd: string | null = null;
    if (percent === 100 && finished.length > 0) {
      const starts = finished.map((b) => b.date_started).filter(Boolean) as string[];
      const ends = finished.map((b) => b.date_finished).filter(Boolean) as string[];
      if (starts.length > 0 && ends.length > 0) {
        const startTimes = starts.map((d) => new Date(d).getTime());
        const endTimes = ends.map((d) => new Date(d).getTime());
        const minStart = Math.min(...startTimes);
        const maxEnd = Math.max(...endTimes);
        journeyStart = new Date(minStart).toISOString();
        journeyEnd = new Date(maxEnd).toISOString();
        journeyDays = Math.round((maxEnd - minStart) / 86400000);
      }
    }

    results.push({
      series,
      finished: finished.length,
      reading: reading.length,
      toRead: toRead.length,
      wishlist: wishlist.length,
      owned: owned.length,
      tracked: tracked.length,
      percent,
      isActivelyReading: reading.length > 0,
      books: sortedBooks,
      journeyDays,
      journeyStart,
      journeyEnd,
    });
  }

  // Priority order: actively reading, then in-progress (partially finished,
  // not currently being read), then fully finished, then not yet started.
  function priority(s: SeriesStat): number {
    if (s.isActivelyReading) return 0;
    if (s.percent > 0 && s.percent < 100) return 1;
    if (s.percent === 100) return 2;
    return 3;
  }

  results.sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    if (pa === 1) return b.percent - a.percent; // most-complete-but-unfinished first
    return a.series.localeCompare(b.series);
  });

  return results;
}

export interface SeriesBinge {
  series: string;
  count: number;
  days: number;
  startDate: string;
  endDate: string;
  books: Book[];
}

// A gap of 14 days or less between consecutive finishes (by date) counts as
// "back to back" — anything looser than that is just normal reading, not a
// binge.
const BINGE_GAP_DAYS = 14;

// Finds the single longest back-to-back run per series — reading multiple
// entries close together in time rather than spread out. Rereads are
// excluded since they're not "more of the series," just a repeat.
export function computeSeriesBinges(books: Book[]): SeriesBinge[] {
  const finished = books.filter((b) => !b.is_reread && b.status === "finished" && b.date_finished);
  const bySeries = new Map<string, Book[]>();
  for (const b of finished) {
    const s = (b.series || "").trim();
    if (!s) continue;
    if (!bySeries.has(s)) bySeries.set(s, []);
    bySeries.get(s)!.push(b);
  }

  const results: SeriesBinge[] = [];
  for (const [series, entries] of bySeries) {
    if (entries.length < 2) continue;
    const sorted = [...entries].sort(
      (a, b) => new Date(a.date_finished!).getTime() - new Date(b.date_finished!).getTime()
    );

    let bestRun: Book[] = [sorted[0]];
    let currentRun: Book[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const gapDays =
        (new Date(sorted[i].date_finished!).getTime() -
          new Date(sorted[i - 1].date_finished!).getTime()) /
        86400000;
      if (gapDays <= BINGE_GAP_DAYS) {
        currentRun.push(sorted[i]);
      } else {
        if (currentRun.length > bestRun.length) bestRun = currentRun;
        currentRun = [sorted[i]];
      }
    }
    if (currentRun.length > bestRun.length) bestRun = currentRun;

    if (bestRun.length >= 2) {
      const first = bestRun[0];
      const last = bestRun[bestRun.length - 1];
      const startDate = first.date_started || first.date_finished!;
      const endDate = last.date_finished!;
      const days = Math.max(
        0,
        Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
      );
      results.push({ series, count: bestRun.length, days, startDate, endDate, books: bestRun });
    }
  }

  // Biggest binges first; among equal-sized binges, the tightest (fewest
  // days) is the more impressive one.
  results.sort((a, b) => b.count - a.count || a.days - b.days);
  return results;
}
