const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";

export interface GoogleVolume {
  id: string;
  title: string;
  authors: string[];
  publisher: string | null;
  publishedDate: string | null;
  description: string | null;
  categories: string[];
  thumbnail: string | null;
  isbn13: string | null;
  isbn10: string | null;
  pageCount: number | null;
  language: string | null;
}

async function searchVolumes(
  q: string,
  maxResults = 20,
  opts: { englishOnly?: boolean } = {}
): Promise<GoogleVolume[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({
    q,
    maxResults: String(maxResults),
    orderBy: "newest",
    printType: "books",
  });
  if (apiKey) params.set("key", apiKey);
  // Google's own steer toward one language — it does cut down on foreign
  // editions, but Google documents this as advisory ("not all books in the
  // results will be in the specified language"), so it's not the real
  // guarantee here; the filter below is.
  if (opts.englishOnly) params.set("langRestrict", "en");

  const res = await fetch(`${GOOGLE_BOOKS_ENDPOINT}?${params.toString()}`, {
    cache: "no-store",
    // Don't let one slow/hung request stall an entire batched refresh.
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Books API error (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const items: any[] = data.items || [];
  const volumes = items.map((item) => {
    const info = item.volumeInfo || {};
    const identifiers: any[] = info.industryIdentifiers || [];
    const rawThumb: string | null =
      info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
    return {
      id: item.id as string,
      title: (info.title as string) || "Untitled",
      authors: (info.authors as string[]) || [],
      publisher: (info.publisher as string) || null,
      publishedDate: (info.publishedDate as string) || null,
      description: (info.description as string) || null,
      categories: (info.categories as string[]) || [],
      // Google serves cover thumbnails over http:// — upgrade to https so
      // they aren't silently blocked as mixed content.
      thumbnail: rawThumb ? rawThumb.replace(/^http:/, "https:") : null,
      isbn13: identifiers.find((i) => i.type === "ISBN_13")?.identifier || null,
      isbn10: identifiers.find((i) => i.type === "ISBN_10")?.identifier || null,
      pageCount: typeof info.pageCount === "number" ? info.pageCount : null,
      language: (info.language as string) || null,
    };
  });

  // The actual guarantee: drop anything explicitly tagged as a non-English
  // language. An untagged result is kept rather than risk losing a real
  // match over missing metadata — Google leaves `language` off some items.
  if (opts.englishOnly) {
    return volumes.filter((v) => !v.language || v.language === "en");
  }
  return volumes;
}

// Google Books search operators don't escape quotes inside the value, so strip
// them defensively — author/publisher names in our data never legitimately
// contain a double quote.
function sanitize(value: string): string {
  return value.replace(/"/g, "");
}

// English-only — this feeds the Upcoming Releases watch list, and an
// author's back-catalog search pulls in every translated edition Google
// has indexed right alongside the real English releases.
export async function searchByAuthor(author: string): Promise<GoogleVolume[]> {
  return searchVolumes(`inauthor:"${sanitize(author)}"`, 20, { englishOnly: true });
}

// ISBN barcode scan lookup — Google's isbn: search operand is an exact
// identifier match, not a keyword search, so a handful of candidates is
// plenty and the first result is normally the right one. Not English-only:
// the ISBN already pins one specific edition, so a language filter here
// would only risk rejecting a legitimate match over stale metadata.
export async function searchByIsbn(isbn: string): Promise<GoogleVolume[]> {
  return searchVolumes(`isbn:${sanitize(isbn)}`, 5);
}

// English-only, same reasoning as searchByAuthor — Black Library's German
// and French Warhammer editions show up in this publisher search too.
export async function searchBlackLibraryCatalog(): Promise<GoogleVolume[]> {
  return searchVolumes(`inpublisher:"Black Library"`, 40, { englishOnly: true });
}

// Used to enrich an existing library entry (cover, description, ISBN).
// English-only for the same reason: an identically (or similarly) titled
// foreign edition can otherwise out-rank the real English one and hand a
// book its wrong-language cover. maxResults is a little higher than the
// bare minimum since the post-filter can remove a few candidates.
export async function searchByTitleAuthor(
  title: string,
  author: string | null
): Promise<GoogleVolume[]> {
  const q = author
    ? `intitle:"${sanitize(title)}" inauthor:"${sanitize(author)}"`
    : `intitle:"${sanitize(title)}"`;
  return searchVolumes(q, 10, { englishOnly: true });
}
