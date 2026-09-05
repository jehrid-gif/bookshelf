import { NextRequest, NextResponse } from "next/server";
import { searchByIsbn } from "@/lib/googleBooks";
import { guessGenre, guessWorld } from "@/lib/releases";
import { normalizeIsbn } from "@/lib/isbn";

export const dynamic = "force-dynamic";

// Used by the barcode-scan flow: given an ISBN read off a book's back-cover
// barcode (or typed in by hand as a fallback), look it up on Google Books and
// hand back a "seed" the Add Book form can pre-fill. Whether a book with this
// ISBN already exists in the library is decided client-side, where the full
// book list — and its isbn field — is already in memory; this route only
// ever talks to Google Books.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("isbn") || "";
  const isbn = normalizeIsbn(raw);
  if (!isbn) {
    return NextResponse.json({ error: "isbn is required" }, { status: 400 });
  }

  try {
    const volumes = await searchByIsbn(isbn);
    if (volumes.length === 0) {
      return NextResponse.json({ found: false });
    }

    // isbn: is an exact-identifier search, so the top hit is normally right —
    // but prefer any candidate whose own ISBN actually matches the scanned
    // number, in case Google's index returns a loosely related edition first.
    const exact = volumes.find(
      (v) =>
        (v.isbn13 && normalizeIsbn(v.isbn13) === isbn) ||
        (v.isbn10 && normalizeIsbn(v.isbn10) === isbn)
    );
    const v = exact || volumes[0];

    const worldGuess = guessWorld(`${v.title} ${v.description || ""}`);

    const seed = {
      title: v.title,
      author: v.authors.length ? v.authors.join(", ") : null,
      genre: guessGenre(v.categories),
      pages: v.pageCount,
      description: v.description,
      cover_url: v.thumbnail,
      isbn: v.isbn13 || v.isbn10 || isbn,
      worlds: worldGuess ? [worldGuess] : [],
    };

    return NextResponse.json({ found: true, seed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
