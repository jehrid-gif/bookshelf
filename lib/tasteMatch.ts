import type { Book } from "./types";
import { computeSuggestionPool, type ReadNextEntry } from "./readNext";

// Minimum number of finished, rated books (rereads excluded — see below)
// before we'll even attempt this. Below that there just isn't enough signal
// to call anything "proven taste" yet.
const MIN_RATED_FOR_FEATURE = 5;

// How strongly small samples get pulled toward the overall average before
// they're trusted — a genre/author/tag you've only got one data point for
// gets pulled most of the way back to your baseline instead of standing on
// that single rating alone. Higher = more skeptical of small samples.
const SHRINKAGE_PRIOR_WEIGHT = 2;

export type FactorType = "genre" | "author" | "mood" | "world";

export interface TasteFactor {
  type: FactorType;
  label: string;
  avg: number; // raw average rating for this tag, unshrunk — shown to the user as-is
  count: number;
  weighted: number; // shrunk toward the overall average — what actually drives the score
}

export interface TasteMatch {
  book: Book;
  reason: string; // the eligibility reason from the underlying suggestion pool entry
  score: number; // roughly on the same 1-5 scale as star ratings
  factors: TasteFactor[]; // strongest first
  why: string; // full natural-language explanation
}

export interface TasteMatchResult {
  matches: TasteMatch[];
  // Present (with a message) when there isn't enough rating history yet to
  // trust any result — the caller should show this instead of a list.
  insufficientData: string | null;
}

interface Accum {
  sum: number;
  count: number;
}

function bump(map: Map<string, Accum>, key: string | null, rating: number) {
  if (!key) return;
  const cur = map.get(key) ?? { sum: 0, count: 0 };
  cur.sum += rating;
  cur.count += 1;
  map.set(key, cur);
}

function weighted(acc: Accum, globalMean: number): { avg: number; count: number; weighted: number } {
  const avg = acc.sum / acc.count;
  const w =
    (acc.count * avg + SHRINKAGE_PRIOR_WEIGHT * globalMean) / (acc.count + SHRINKAGE_PRIOR_WEIGHT);
  return { avg, count: acc.count, weighted: w };
}

function factorSentence(f: TasteFactor): string {
  const stars = `${f.avg.toFixed(1)}★`;
  const books = `${f.count} book${f.count === 1 ? "" : "s"}`;
  switch (f.type) {
    case "genre":
      return `it's ${f.label} — a genre you've rated ${stars} on average across ${books}`;
    case "author":
      return `you've already rated ${f.label} ${stars} on average across ${books}`;
    case "mood":
      return `it's tagged "${f.label}", a mood you've rated ${stars} across ${books}`;
    case "world":
      return `it's set in ${f.label}, which you've rated ${stars} across ${books}`;
  }
}

function buildWhy(book: Book, factors: TasteFactor[]): string {
  if (factors.length === 0) return "";
  const top = factors.slice(0, 3);
  const clauses = top.map(factorSentence);
  let sentence: string;
  if (clauses.length === 1) {
    sentence = `This made the list because ${clauses[0]}.`;
  } else if (clauses.length === 2) {
    sentence = `This made the list because ${clauses[0]}, and ${clauses[1]}.`;
  } else {
    sentence = `This made the list because ${clauses[0]}, ${clauses[1]}, and ${clauses[2]}.`;
  }
  // Call out when the author is new — honest about which part of the match
  // is proven vs. unproven, rather than implying the whole pick is a sure bet.
  const hasAuthorFactor = factors.some((f) => f.type === "author");
  if (!hasAuthorFactor && book.author) {
    sentence += ` You haven't rated a book by ${book.author} before, so that part's a bit of a leap.`;
  }
  const lowSample = top.find((f) => f.count === 1);
  if (lowSample) {
    sentence += ` Worth noting: the ${lowSample.label} match is based on just one book so far.`;
  }
  return sentence;
}

/**
 * Ranks your owned, unread books (the same eligible pool Suggestions/Dice
 * draw from — series order respected) by how well they match the taste
 * profile built from your own finished, rated books. Pure function of
 * current data — rate a few new books differently and the profile (and
 * therefore the ranking) shifts the next time this runs.
 */
export function computeTasteMatches(books: Book[], limit = 10): TasteMatchResult {
  const rated = books.filter(
    (b) => b.status === "finished" && !b.is_reread && typeof b.my_rating === "number"
  );

  if (rated.length < MIN_RATED_FOR_FEATURE) {
    return {
      matches: [],
      insufficientData: `Rate a few more finished books (${rated.length}/${MIN_RATED_FOR_FEATURE} so far) to unlock personalized matches.`,
    };
  }

  const globalMean = rated.reduce((s, b) => s + b.my_rating!, 0) / rated.length;

  const genreAcc = new Map<string, Accum>();
  const authorAcc = new Map<string, Accum>();
  const moodAcc = new Map<string, Accum>();
  const worldAcc = new Map<string, Accum>();

  for (const b of rated) {
    const r = b.my_rating!;
    bump(genreAcc, b.genre, r);
    bump(authorAcc, b.author, r);
    for (const m of b.moods) bump(moodAcc, m, r);
    for (const w of b.worlds) bump(worldAcc, w, r);
  }

  type Weighted = { avg: number; count: number; weighted: number };
  function toAffinity(acc: Map<string, Accum>): Map<string, Weighted> {
    const out = new Map<string, Weighted>();
    for (const [k, v] of acc) out.set(k, weighted(v, globalMean));
    return out;
  }
  const genreAffinity = toAffinity(genreAcc);
  const authorAffinity = toAffinity(authorAcc);
  const moodAffinity = toAffinity(moodAcc);
  const worldAffinity = toAffinity(worldAcc);

  function scoreEntry(entry: ReadNextEntry): TasteMatch | null {
    const b = entry.book;
    const factors: TasteFactor[] = [];

    if (b.genre && genreAffinity.has(b.genre)) {
      const x = genreAffinity.get(b.genre)!;
      factors.push({ type: "genre", label: b.genre, ...x });
    }
    if (b.author && authorAffinity.has(b.author)) {
      const x = authorAffinity.get(b.author)!;
      factors.push({ type: "author", label: b.author, ...x });
    }
    for (const m of b.moods) {
      if (moodAffinity.has(m)) {
        const x = moodAffinity.get(m)!;
        factors.push({ type: "mood", label: m, ...x });
      }
    }
    for (const w of b.worlds) {
      if (worldAffinity.has(w)) {
        const x = worldAffinity.get(w)!;
        factors.push({ type: "world", label: w, ...x });
      }
    }

    // No overlap at all with anything you've ever rated — nothing "proven"
    // to base a recommendation on, so it's excluded rather than scored as
    // a false-neutral average.
    if (factors.length === 0) return null;

    factors.sort((a, b2) => b2.weighted - a.weighted);
    const score = factors.reduce((s, f) => s + f.weighted, 0) / factors.length;

    return {
      book: b,
      reason: entry.reason,
      score,
      factors,
      why: buildWhy(b, factors),
    };
  }

  const pool = computeSuggestionPool(books);
  const scored = pool
    .map(scoreEntry)
    .filter((m): m is TasteMatch => m !== null)
    .sort((a, b) => b.score - a.score);

  return { matches: scored.slice(0, limit), insufficientData: null };
}

export interface TasteSnapshotEntry {
  book_id: string;
  rank: number;
  score: number;
}

export type MatchMovement =
  | { kind: "new" }
  | { kind: "up"; amount: number }
  | { kind: "down"; amount: number }
  | { kind: "same" };

// Compares this run's ranking against the last-saved snapshot (from the
// previous time this list was viewed, on any device — it's stored server
// side) so a book climbing or dropping, or a brand-new entry, is visible at
// a glance rather than something you'd have to notice by memory.
export function computeMovement(
  matches: TasteMatch[],
  previous: TasteSnapshotEntry[]
): Map<string, MatchMovement> {
  const prevRank = new Map(previous.map((p) => [p.book_id, p.rank]));
  const result = new Map<string, MatchMovement>();
  matches.forEach((m, i) => {
    const rank = i + 1;
    const prev = prevRank.get(m.book.trello_id);
    if (prev === undefined) {
      result.set(m.book.trello_id, { kind: "new" });
    } else if (prev > rank) {
      result.set(m.book.trello_id, { kind: "up", amount: prev - rank });
    } else if (prev < rank) {
      result.set(m.book.trello_id, { kind: "down", amount: rank - prev });
    } else {
      result.set(m.book.trello_id, { kind: "same" });
    }
  });
  return result;
}
