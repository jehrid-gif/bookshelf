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
