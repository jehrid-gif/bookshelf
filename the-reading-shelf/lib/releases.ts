import { query } from "./db";
import type { Book } from "./types";
import { searchByAuthor, searchBlackLibraryCatalog, type GoogleVolume } from "./googleBooks";

// How far back to keep showing a release after its date has passed, in case
// the daily refresh runs a little after a book actually comes out.
const RELEVANT_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

function parseGoogleDate(raw: string | null | undefined, roundUp: boolean): Date | null {
  if (!raw) return null;
  const parts = raw.split("-").map((p) => parseInt(p, 10));
  if (parts.length === 0 || parts.some((p) => Number.isNaN(p))) return null;
  const [year, month, day] = parts;
  if (day !== undefined) return new Date(Date.UTC(year, month - 1, day));
  if (month !== undefined) {
    // Google gives "YYYY-MM" for books without a firm release day yet.
    return roundUp ? new Date(Date.UTC(year, month, 0)) : new Date(Date.UTC(year, month - 1, 1));
  }
  return roundUp ? new Date(Date.UTC(year, 11, 31)) : new Date(Date.UTC(year, 0, 1));
}

// Generous check used when deciding whether to keep a listing at all —
// rounds ambiguous dates UP so a "2026"-only forthcoming title isn't
// dropped just because we assumed January.
export function isRelevantRelease(raw: string | null | undefined): boolean {
  const d = parseGoogleDate(raw, true);
  if (!d) return false;
  return d.getTime() >= Date.now() - RELEVANT_WINDOW_MS;
}

// Stricter check used for the "Upcoming" vs "Recently Released" split on the
// page — rounds DOWN so we don't call something upcoming on a guess.
export function isFutureRelease(raw: string | null | undefined): boolean {
  const d = parseGoogleDate(raw, false);
  if (!d) return false;
  return d.getTime() >= Date.now();
}

function guessGenre(categories: string[]): string | null {
  const joined = categories.join(" ").toLowerCase();
  if (joined.includes("fantasy")) return "Fantasy";
  if (joined.includes("science fiction")) return "Science Fiction";
  return null;
}

const WORLD_KEYWORDS: [string, string][] = [
  ["age of sigmar", "Warhammer: Age of Sigmar"],
  ["stormcast", "Warhammer: Age of Sigmar"],
  ["sigmar", "Warhammer: Age of Sigmar"],
  ["horus heresy", "Warhammer 40,000"],
  ["40,000", "Warhammer 40,000"],
  ["40k", "Warhammer 40,000"],
  ["warhammer", "Warhammer 40,000"],
];

function guessWorld(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [kw, world] of WORLD_KEYWORDS) {
    if (lower.includes(kw)) return world;
  }
  return null;
}

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Decide whether a candidate volume from a watched author's back-catalog
// search is plausibly Sci-Fi/Fantasy, using what we already know about that
// author's genre from their books already in the library as the primary
// signal (Google's category tags are often missing on pre-release listings).
function includeForAuthorWatch(volume: GoogleVolume, authorGenres: Set<string>): boolean {
  const catJoined = volume.categories.join(" ").toLowerCase();
  const catIsSFF = catJoined.includes("fantasy") || catJoined.includes("science fiction");
  if (catIsSFF) return true;

  const catIsClearlyOffGenre =
    volume.categories.length > 0 &&
    /biograph|cooking|business|self-help|health|travel|religion|cookbook/.test(catJoined);

  if (authorGenres.has("Fantasy") || authorGenres.has("Science Fiction")) {
    return !catIsClearlyOffGenre;
  }
  // No genre history for this author (a manually-watched author not yet in
  // the library) and no category data to go on — include it rather than
  // silently drop a real forthcoming book.
  return volume.categories.length === 0;
}

async function upsertRelease(
  volume: GoogleVolume,
  opts: { isBlackLibrary: boolean; matchedWatch: boolean; source: string }
) {
  const genreGuess = guessGenre(volume.categories);
  const worldGuess = guessWorld(`${volume.title} ${volume.description || ""}`);
  await query(
    `INSERT INTO upcoming_releases (
      google_id, title, author, publisher, published_date, description, cover_url,
      genre_guess, world_guess, is_black_library, matched_watch, source, last_seen_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
    ON CONFLICT (google_id) DO UPDATE SET
      title = EXCLUDED.title,
      author = EXCLUDED.author,
      publisher = EXCLUDED.publisher,
      published_date = EXCLUDED.published_date,
      description = EXCLUDED.description,
      cover_url = EXCLUDED.cover_url,
      genre_guess = EXCLUDED.genre_guess,
      world_guess = EXCLUDED.world_guess,
      is_black_library = upcoming_releases.is_black_library OR EXCLUDED.is_black_library,
      matched_watch = upcoming_releases.matched_watch OR EXCLUDED.matched_watch,
      last_seen_at = now()`,
    [
      volume.id,
      volume.title,
      volume.authors.join(", ") || null,
      volume.publisher,
      volume.publishedDate,
      volume.description,
      volume.thumbnail,
      genreGuess,
      worldGuess,
      opts.isBlackLibrary,
      opts.matchedWatch,
      opts.source,
    ]
  );
}

export interface RefreshResult {
  authorsChecked: number;
  upserted: number;
  errors: string[];
}

// Runs `fn` over `items` with at most `limit` in flight at once. A library
// with hundreds of authors can't check them one at a time and still finish
// inside a serverless function's time limit.
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
}

const AUTHOR_CONCURRENCY = 15;

export async function refreshReleases(): Promise<RefreshResult> {
  const errors: string[] = [];
  let upserted = 0;

  const books = await query<Book>(`SELECT author, genre, title, series FROM books`);
  const existingKeys = new Set(
    books.map((b) => `${normalize(b.title)}::${normalize(b.author)}`)
  );
  const existingSeries = new Set(
    books.map((b) => normalize(b.series)).filter(Boolean)
  );

  const authorGenreMap = new Map<string, Set<string>>();
  for (const b of books) {
    if (!b.author) continue;
    if (!authorGenreMap.has(b.author)) authorGenreMap.set(b.author, new Set());
    if (b.genre) authorGenreMap.get(b.author)!.add(b.genre);
  }

  const manuallyWatched = await query<{ name: string }>(`SELECT name FROM watched_authors`);
  const allAuthors = Array.from(
    new Set<string>([
      ...Array.from(authorGenreMap.keys()),
      ...manuallyWatched.map((r) => r.name),
    ])
  );
  const allAuthorsSet = new Set(allAuthors);

  let authorsChecked = 0;

  await mapWithConcurrency(allAuthors, AUTHOR_CONCURRENCY, async (author) => {
    authorsChecked++;
    try {
      const volumes = await searchByAuthor(author);
      const authorGenres = authorGenreMap.get(author) || new Set<string>();
      for (const v of volumes) {
        if (!isRelevantRelease(v.publishedDate)) continue;
        const key = `${normalize(v.title)}::${normalize(v.authors[0] || author)}`;
        if (existingKeys.has(key)) continue; // already own it
        if (!includeForAuthorWatch(v, authorGenres)) continue;
        await upsertRelease(v, { isBlackLibrary: false, matchedWatch: true, source: "author_watch" });
        upserted++;
      }
    } catch (err: any) {
      errors.push(`${author}: ${err.message}`);
    }
  });

  try {
    const blVolumes = await searchBlackLibraryCatalog();
    for (const v of blVolumes) {
      if (!isRelevantRelease(v.publishedDate)) continue;
      const key = `${normalize(v.title)}::${normalize(v.authors[0] || "")}`;
      if (existingKeys.has(key)) continue;
      const authorMatch = v.authors.some((a) => allAuthorsSet.has(a));
      const seriesMatch = Array.from(existingSeries).some(
        (s) => s && normalize(v.title).includes(s)
      );
      await upsertRelease(v, {
        isBlackLibrary: true,
        matchedWatch: authorMatch || seriesMatch,
        source: "black_library",
      });
      upserted++;
    }
  } catch (err: any) {
    errors.push(`Black Library: ${err.message}`);
  }

  return { authorsChecked, upserted, errors };
}
