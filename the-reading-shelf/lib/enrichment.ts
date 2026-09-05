import { query, queryOne } from "./db";
import type { Book } from "./types";
import { searchByTitleAuthor, type GoogleVolume } from "./googleBooks";

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenOverlap(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const t of aTokens) if (bTokens.has(t)) overlap++;
  return overlap / Math.max(aTokens.size, bTokens.size);
}

interface ScoredMatch {
  volume: GoogleVolume;
  confidence: "matched" | "low_confidence";
}

// Picks the best candidate volume for a book and grades how sure we are —
// Google's search is by keyword, not exact lookup, so a bad title match
// (wrong book in a series, an omnibus, a foreign edition) is common enough
// that we never blindly trust the top result.
function scoreMatch(
  book: { title: string; author: string | null },
  volumes: GoogleVolume[]
): ScoredMatch | null {
  const bookTitle = normalize(book.title);
  const bookAuthor = normalize(book.author);
  let best: { volume: GoogleVolume; titleScore: number; authorMatch: boolean } | null = null;

  for (const v of volumes) {
    const volTitle = normalize(v.title);
    const titleScore = volTitle === bookTitle ? 1 : tokenOverlap(bookTitle, volTitle);
    const authorMatch =
      !bookAuthor ||
      v.authors.some((a) => {
        const na = normalize(a);
        return na === bookAuthor || na.includes(bookAuthor) || bookAuthor.includes(na);
      });
    if (!best || titleScore > best.titleScore) {
      best = { volume: v, titleScore, authorMatch };
    }
  }

  if (!best || best.titleScore < 0.34) return null;

  const confidence: "matched" | "low_confidence" =
    best.titleScore >= 0.8 && best.authorMatch ? "matched" : "low_confidence";
  return { volume: best.volume, confidence };
}

function bestIsbn(v: GoogleVolume): string | null {
  return v.isbn13 || v.isbn10 || null;
}

export interface EnrichOutcome {
  status: "matched" | "low_confidence" | "not_found" | "skipped" | "error";
  book?: Book;
}

// Looks up a single book on Google Books and fills in cover/description/isbn.
// By default only fills fields that are currently empty, so it never
// clobbers a manual edit or one of the handful of covers already set —
// pass force to overwrite anyway (used by the "Refetch" button when a match
// was wrong and the user wants a redo).
export async function enrichBook(
  book: Book,
  opts: { force?: boolean } = {}
): Promise<EnrichOutcome> {
  if (!book.title) return { status: "skipped" };
  try {
    const volumes = await searchByTitleAuthor(book.title, book.author);
    const match = volumes.length ? scoreMatch(book, volumes) : null;

    if (!match) {
      const updated = await queryOne<Book>(
        `UPDATE books SET enrichment_status = 'not_found', enrichment_checked_at = now()
         WHERE trello_id = $1 RETURNING *`,
        [book.trello_id]
      );
      return { status: "not_found", book: updated ?? undefined };
    }

    const v = match.volume;
    const coverExpr = opts.force ? "$2" : "COALESCE(books.cover_url, $2)";
    const descExpr = opts.force ? "$3" : "COALESCE(books.description, $3)";
    const isbnExpr = opts.force ? "$4" : "COALESCE(books.isbn, $4)";

    const updated = await queryOne<Book>(
      `UPDATE books SET
        cover_url = ${coverExpr},
        description = ${descExpr},
        isbn = ${isbnExpr},
        enrichment_status = $5,
        enrichment_checked_at = now()
      WHERE trello_id = $1 RETURNING *`,
      [book.trello_id, v.thumbnail, v.description, bestIsbn(v), match.confidence]
    );
    return { status: match.confidence, book: updated ?? undefined };
  } catch {
    return { status: "error" };
  }
}

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
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

export interface BatchEnrichResult {
  processed: number;
  matched: number;
  lowConfidence: number;
  notFound: number;
  errors: number;
  remaining: number;
}

const BATCH_CONCURRENCY = 10;

// Processes up to `limit` never-checked books per call. The client drives
// this in chunks (see /api/books/enrich-batch) so the full ~1,000-book
// backfill runs as a series of short, well-under-the-timeout requests
// instead of one call that can't finish in time.
export async function runEnrichmentBatch(limit: number): Promise<BatchEnrichResult> {
  const books = await query<Book>(
    `SELECT * FROM books WHERE enrichment_status IS NULL ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );

  let matched = 0;
  let lowConfidence = 0;
  let notFound = 0;
  let errors = 0;

  await mapWithConcurrency(books, BATCH_CONCURRENCY, async (book) => {
    const outcome = await enrichBook(book);
    if (outcome.status === "matched") matched++;
    else if (outcome.status === "low_confidence") lowConfidence++;
    else if (outcome.status === "not_found") notFound++;
    else if (outcome.status === "error") errors++;
  });

  const remainingRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM books WHERE enrichment_status IS NULL`
  );

  return {
    processed: books.length,
    matched,
    lowConfidence,
    notFound,
    errors,
    remaining: remainingRow ? Number(remainingRow.count) : 0,
  };
}
