"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BookForm from "@/components/BookForm";
import BookDetail from "@/components/BookDetail";
import BookCover from "@/components/BookCover";
import Modal from "@/components/Modal";
import type { Book } from "@/lib/types";
import { GENRES, STATUSES, FORMATS, WORLDS, MOODS, isIncomplete } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  to_read: "To Read",
  reading: "Reading",
  finished: "Finished",
  wishlist: "Wishlist",
};

function LibraryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<{ book: Book; mode: "view" | "edit" } | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [genre, setGenre] = useState("");
  const [series, setSeries] = useState("");
  const [world, setWorld] = useState("");
  const [mood, setMood] = useState("");
  const [format, setFormat] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [sortBy, setSortBy] = useState("shelf");
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  const incompleteCursor = useRef(0);

  async function load() {
    try {
      const res = await fetch("/api/books");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load books");
      setBooks(data as Book[]);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Read initial filters from the URL (deep links from the Dashboard etc.)
  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setStatus(s);
    const g = searchParams.get("genre");
    if (g) setGenre(g);
    const f = searchParams.get("format");
    if (f) setFormat(f);
    if (searchParams.get("new") === "1") {
      setAdding(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("incomplete") === "1" && books) {
      setIncompleteOnly(true);
      const list = books.filter(isIncomplete);
      if (list.length > 0) setViewing({ book: list[0], mode: "edit" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, books]);

  function clearDeepLinkParams() {
    if (
      searchParams.get("new") === "1" ||
      searchParams.get("incomplete") === "1" ||
      searchParams.get("status") ||
      searchParams.get("genre") ||
      searchParams.get("format")
    ) {
      router.replace("/library");
    }
  }

  function closeAdding() {
    setAdding(false);
    clearDeepLinkParams();
  }

  function closeViewing() {
    setViewing(null);
    clearDeepLinkParams();
  }

  const seriesList = useMemo(() => {
    if (!books) return [];
    const set = new Set<string>();
    for (const b of books) if (b.series && b.series.trim()) set.add(b.series.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [books]);

  const incompleteBooks = useMemo(() => {
    if (!books) return [];
    return books.filter(isIncomplete);
  }, [books]);

  const uncheckedCount = useMemo(() => {
    if (!books) return 0;
    return books.filter((b) => !b.enrichment_status).length;
  }, [books]);

  const reviewBooks = useMemo(() => {
    if (!books) return [];
    return books.filter((b) => b.enrichment_status === "low_confidence");
  }, [books]);

  const filtered = useMemo(() => {
    if (!books) return [];
    let list = books;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author || "").toLowerCase().includes(q)
      );
    }
    if (status) list = list.filter((b) => b.status === status);
    if (genre) list = list.filter((b) => b.genre === genre);
    if (series) list = list.filter((b) => (b.series || "") === series);
    if (world) list = list.filter((b) => b.worlds.includes(world));
    if (mood) list = list.filter((b) => b.moods.includes(mood));
    if (format) list = list.filter((b) => b.format === format);
    if (incompleteOnly) list = list.filter(isIncomplete);
    if (needsReviewOnly) list = list.filter((b) => b.enrichment_status === "low_confidence");

    const sorted = [...list];
    switch (sortBy) {
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "author":
        sorted.sort((a, b) => (a.author || "").localeCompare(b.author || ""));
        break;
      case "series":
        sorted.sort(
          (a, b) =>
            (a.series || "").localeCompare(b.series || "") ||
            (a.series_index || 0) - (b.series_index || 0)
        );
        break;
      case "pages":
        sorted.sort((a, b) => (a.pages || 0) - (b.pages || 0));
        break;
      case "rating":
        sorted.sort((a, b) => (b.my_rating || 0) - (a.my_rating || 0));
        break;
      default:
        sorted.sort((a, b) => a.board_pos - b.board_pos || a.title.localeCompare(b.title));
    }
    return sorted;
  }, [
    books,
    search,
    status,
    genre,
    series,
    world,
    mood,
    format,
    incompleteOnly,
    needsReviewOnly,
    sortBy,
  ]);

  function resetFilters() {
    setSearch("");
    setStatus("");
    setGenre("");
    setSeries("");
    setWorld("");
    setMood("");
    setFormat("");
    setIncompleteOnly(false);
    setNeedsReviewOnly(false);
  }

  async function runEnrichment() {
    setEnriching(true);
    setError(null);
    let done = 0;
    const total = uncheckedCount;
    setEnrichProgress({ done: 0, total });
    try {
      // Drive the backfill in chunks from the client — each call only takes
      // a small bite (well under the serverless time limit), so this keeps
      // going until nothing's left, however many books that takes.
      //
      // Hard backstop: every book should get a terminal, non-null status in
      // one pass, so this should never take more than ~total/40 round trips.
      // If something upstream still misbehaves (e.g. a write silently fails
      // to persist), stop well short of looping forever instead of hammering
      // the API and DB indefinitely.
      const maxIterations = Math.max(20, Math.ceil(total / 40) + 10);
      let iterations = 0;
      let stalled = 0;
      let lastRemaining = Infinity;
      while (true) {
        iterations++;
        const res = await fetch("/api/books/enrich-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 40 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Enrichment failed");
        done += data.processed;
        setEnrichProgress({ done, total: Math.max(total, done + data.remaining) });
        if (data.processed === 0 || data.remaining === 0) break;

        stalled = data.remaining >= lastRemaining ? stalled + 1 : 0;
        lastRemaining = data.remaining;
        if (stalled >= 3) {
          throw new Error(
            `Stopped: ${data.remaining} book(s) aren't making progress (repeated lookup failures). Try again later.`
          );
        }
        if (iterations >= maxIterations) {
          throw new Error(
            `Stopped after ${iterations} batches as a safety limit — ${data.remaining} book(s) still unchecked.`
          );
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setEnriching(false);
      setEnrichProgress(null);
      load();
    }
  }

  function jumpToIncomplete() {
    if (incompleteBooks.length === 0) return;
    const b = incompleteBooks[incompleteCursor.current % incompleteBooks.length];
    incompleteCursor.current += 1;
    setViewing({ book: b, mode: "edit" });
  }

  function applySavedBook(updated: Book) {
    setBooks((prev) => {
      if (!prev) return prev;
      const exists = prev.some((b) => b.trello_id === updated.trello_id);
      if (exists) {
        return prev.map((b) => (b.trello_id === updated.trello_id ? updated : b));
      }
      return [updated, ...prev];
    });
  }

  function handleAdded(created: Book) {
    applySavedBook(created);
    closeAdding();
  }

  function handleDeleted(id: string) {
    setBooks((prev) => (prev ? prev.filter((b) => b.trello_id !== id) : prev));
    closeViewing();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-ink">Library</h1>
        <div className="flex items-center gap-2">
          {incompleteBooks.length > 0 && (
            <button className="btn btn-secondary" onClick={jumpToIncomplete}>
              ⚠ Jump to Next Incomplete ({incompleteBooks.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            + Add Book
          </button>
        </div>
      </div>

      {uncheckedCount > 0 && (
        <div className="card border-sky-200 bg-sky-50 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-sky-900">
            🔍 {uncheckedCount} book{uncheckedCount === 1 ? "" : "s"} haven't been checked
            against Google Books yet for cover art, description, and ISBN.
            {enriching && enrichProgress && ` Checking… ${enrichProgress.done}/${enrichProgress.total}`}
          </p>
          <button className="btn btn-secondary" onClick={runEnrichment} disabled={enriching}>
            {enriching ? "Checking…" : "Check Google Books"}
          </button>
        </div>
      )}

      <div className="card space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <input
            className="input col-span-2 lg:col-span-2"
            placeholder="Search title or author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">All genres</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select className="input" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="">All formats</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="shelf">Sort: Shelf order</option>
            <option value="title">Sort: Title</option>
            <option value="author">Sort: Author</option>
            <option value="series">Sort: Series</option>
            <option value="pages">Sort: Pages</option>
            <option value="rating">Sort: Rating</option>
          </select>
          <select className="input" value={series} onChange={(e) => setSeries(e.target.value)}>
            <option value="">All series</option>
            {seriesList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="input" value={world} onChange={(e) => setWorld(e.target.value)}>
            <option value="">All worlds</option>
            {WORLDS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <select className="input" value={mood} onChange={(e) => setMood(e.target.value)}>
            <option value="">All moods</option>
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm px-1">
            <input
              type="checkbox"
              checked={incompleteOnly}
              onChange={(e) => setIncompleteOnly(e.target.checked)}
            />
            Missing data only
          </label>
          <label className="flex items-center gap-2 text-sm px-1">
            <input
              type="checkbox"
              checked={needsReviewOnly}
              onChange={(e) => setNeedsReviewOnly(e.target.checked)}
            />
            Needs review ({reviewBooks.length})
          </label>
          <button className="btn btn-secondary" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      {!books && !error && <p className="text-stone-500">Loading your shelf…</p>}

      {books && (
        <>
          <p className="text-sm text-stone-500">
            Showing {filtered.length} of {books.length} books
          </p>
          <div className="card !p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold"></th>
                  <th className="text-left px-3 py-2 font-semibold"></th>
                  <th className="text-left px-3 py-2 font-semibold">Title</th>
                  <th className="text-left px-3 py-2 font-semibold">Author</th>
                  <th className="text-left px-3 py-2 font-semibold">Series</th>
                  <th className="text-left px-3 py-2 font-semibold">Genre</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-left px-3 py-2 font-semibold">Pages</th>
                  <th className="text-left px-3 py-2 font-semibold">Rating</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.trello_id}
                    className="border-t border-stone-100 hover:bg-parchment/50 cursor-pointer"
                    onClick={() => setViewing({ book: b, mode: "view" })}
                  >
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        {isIncomplete(b) && (
                          <span title="Missing genre or page count">⚠️</span>
                        )}
                        {b.enrichment_status === "low_confidence" && (
                          <span title="Uncertain Google Books match — verify cover/description">
                            🔍
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <BookCover
                        book={b}
                        className="w-8 h-11 rounded"
                        padding="p-0.5"
                        textSize="text-[5px]"
                        lineClamp="line-clamp-4"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-ink">
                      {b.title}
                      {b.special_edition && (
                        <span className="ml-1.5 badge bg-brass/10 text-amber-900">
                          special
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-stone-600">{b.author || "—"}</td>
                    <td className="px-3 py-2 text-stone-600">
                      {b.series ? `${b.series}${b.series_index ? ` #${b.series_index}` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-stone-600">{b.genre || "—"}</td>
                    <td className="px-3 py-2 text-stone-600">{STATUS_LABEL[b.status]}</td>
                    <td className="px-3 py-2 text-stone-600">{b.pages ?? "—"}</td>
                    <td className="px-3 py-2 text-stone-600">
                      {b.my_rating ? "★".repeat(b.my_rating) : "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-stone-400">
                      No books match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {adding && (
        <Modal title="Add Book" onClose={closeAdding}>
          <BookForm book={null} onSaved={handleAdded} onCancel={closeAdding} />
        </Modal>
      )}

      {viewing && (
        <BookDetail
          book={viewing.book}
          initialMode={viewing.mode}
          onClose={closeViewing}
          onSaved={applySavedBook}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<p className="text-stone-500">Loading…</p>}>
      <LibraryInner />
    </Suspense>
  );
}
