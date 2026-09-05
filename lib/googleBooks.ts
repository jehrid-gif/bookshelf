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
}

async function searchVolumes(q: string, maxResults = 20): Promise<GoogleVolume[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const params = new URLSearchParams({
    q,
    maxResults: String(maxResults),
    orderBy: "newest",
    printType: "books",
  });
  if (apiKey) params.set("key", apiKey);

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
  return items.map((item) => {
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
    };
  });
}

// Google Books search operators don't escape quotes inside the value, so strip
// them defensively — author/publisher names in our data never legitimately
// contain a double quote.
function sanitize(value: string): string {
  return value.replace(/"/g, "");
}

export async function searchByAuthor(author: string): Promise<GoogleVolume[]> {
  return searchVolumes(`inauthor:"${sanitize(author)}"`, 20);
}

export async function searchBlackLibraryCatalog(): Promise<GoogleVolume[]> {
  return searchVolumes(`inpublisher:"Black Library"`, 40);
}

// Used to enrich an existing library entry (cover, description, ISBN) —
// we only need a handful of candidates to pick the best match from.
export async function searchByTitleAuthor(
  title: string,
  author: string | null
): Promise<GoogleVolume[]> {
  const q = author
    ? `intitle:"${sanitize(title)}" inauthor:"${sanitize(author)}"`
    : `intitle:"${sanitize(title)}"`;
  return searchVolumes(q, 5);
}
