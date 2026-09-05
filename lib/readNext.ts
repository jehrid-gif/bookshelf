import type { Book } from "./types";

export interface ReadNextEntry {
  series: string;
  book: Book;
  reason: string;
}

/**
 * Computes, for every series that has at least one non-finished book, which
 * single book is the correct "read next" pick — based on actual finished
 * status in the data rather than trusting the (possibly stale) imported
 * series_position tag.
 */
export function computeReadNext(books: Book[]): ReadNextEntry[] {
  const bySeries = new Map<string, Book[]>();
  for (const b of books) {
    const s = (b.series || "").trim();
    if (!s) continue;
    if (!bySeries.has(s)) bySeries.set(s, []);
    bySeries.get(s)!.push(b);
  }

  const results: ReadNextEntry[] = [];

  for (const [series, entries] of bySeries) {
    // Already actively reading something in this series — that's covered by
    // the Currently Reading panel, not Read Next.
    if (entries.some((b) => b.status === "reading")) continue;

    // Only suggest continuing a series you've already started — at least one
    // book in it needs to already be finished. Brand-new/unstarted series
    // don't show up here.
    if (!entries.some((b) => b.status === "finished")) continue;

    const toRead = entries.filter((b) => b.status === "to_read");
    if (toRead.length === 0) continue;

    const indexed = entries.filter((b) => b.series_index !== null);
    const hasIndexData = indexed.length > 0;

    if (hasIndexData) {
      // Smallest series_index among to_read entries, only valid if every
      // smaller-index sibling (with a known index) is already finished.
      const candidates = toRead
        .filter((b) => b.series_index !== null)
        .sort((a, b) => (a.series_index! - b.series_index!));

      let pick: Book | undefined;
      for (const cand of candidates) {
        const blockers = indexed.filter(
          (b) =>
            b.series_index! < cand.series_index! &&
            b.status !== "finished" &&
            b.trello_id !== cand.trello_id
        );
        if (blockers.length === 0) {
          pick = cand;
          break;
        }
      }

      if (pick) {
        results.push({
          series,
          book: pick,
          reason: `Book ${pick.series_index} in ${series} — earlier volumes finished`,
        });
        continue;
      }

      // No cleanly-indexed candidate unlocked yet; fall through to tag-based
      // logic for un-indexed to_read entries (e.g. a starter with no index).
    }

    const tagPick = toRead.find(
      (b) =>
        b.series_position === "starter" ||
        b.series_position === "standalone" ||
        b.series_position === "next_in_series"
    );
    if (tagPick) {
      results.push({
        series,
        book: tagPick,
        reason:
          tagPick.series_position === "starter"
            ? `First book of ${series}`
            : tagPick.series_position === "standalone"
            ? `Standalone entry in ${series}`
            : `Tagged as next in ${series}`,
      });
    }
  }

  results.sort((a, b) => a.series.localeCompare(b.series));
  return results;
}

export function computeCurrentlyReading(books: Book[]): Map<string, Book[]> {
  const map = new Map<string, Book[]>();
  for (const b of books) {
    if (b.status !== "reading") continue;
    const s = (b.series || "Standalone").trim() || "Standalone";
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push(b);
  }
  return map;
}
