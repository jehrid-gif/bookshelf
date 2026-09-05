"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BookForm from "@/components/BookForm";
import BookDetail from "@/components/BookDetail";
import BookCover from "@/components/BookCover";
import Modal from "@/components/Modal";
import SearchFilterBar from "@/components/SearchFilterBar";
import type { Book } from "@/lib/types";
import { GENRES, STATUSES, FORMATS, WORLDS, MOODS, isIncomplete } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  to_read: "To Read",
  reading: "Reading",
  finished: "Finished",
  wishlist: "Wishlist",
};

function normalizeForDupe(s: string | null): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type SortKey = "title" | "author" | "series" | "genre" | "status" | "pages" | "rating";

const COMPARATORS: Record<SortKey, (a: Book, b: Book) => number> = {
  title: (a, b) => a.title.localeCompare(b.title),
  author: (a, b) => (a.author || "").localeCompare(b.author || ""),
  series: (a, b) =>
    (a.series || "").localeCompare(b.series || "") ||
    (a.series_index || 0) - (b.series_index || 0),
  genre: (a, b) => (a.genre || "").localeCompare(b.genre || ""),
  status: (a, b) => STATUS_LABEL[a.status].localeCompare(STATUS_LABEL[b.status]),
  pages: (a, b) => (a.pages || 0) - (b.pages || 0),
  rating: (a, b) => (a.my_rating || 0) - (b.my_rating || 0),
};

function LibraryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<{ book: Book; mode: "view" | "edit" } | null>(null);

  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [genre, setGenre] = useState("");
  const [series, setSeries] = useState("");
  const [world, setWorld] = useState("");
  const [mood, setMood] = useState("");
  const [format, setFormat] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [physicalTodoOnly, setPhysicalTodoOnly] = useState(false);
  const [specialEditionsOnly, setSpecialEditionsOnly] = useState(false);
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
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

  // Read initial filters from the URL (deep links from the Dashboard, or
  // from the old Physical/Special Editions/Duplicates pages).
  useEffect(() => {
    const s = searchParams.get("status");
    if (s) setStatus(s);
    const g = searchParams.get("genre");
    if (g) setGenre(g);
    const f = searchParams.get("format");
    if (f) setFormat(f);
    const filter = searchParams.get("filter");
    if (filter === "physical_todo") {
      setPhysicalTodoOnly(true);
      setFiltersOpen(true);
    } else if (filter === "special_editions") {
      setSpecialEditionsOnly(true);
      setFiltersOpen(true);
    } else if (filter === "duplicates") {
      setDuplicatesOnly(true);
      setFiltersOpen(true);
    }
    if (searchParams.get("new") === "1") {
      setAdding(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("incomplete") === "1" && books) {
      setIncompleteOnly(true);
      setFiltersOpen(true);
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
      searchParams.get("format") ||
      searchParams.get("filter")
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

  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    if (!books) return ids;
    const groups = new Map<string, Book[]>();
    for (const b of books) {
      const key = `${normalizeForDupe(b.title)}::${normalizeForDupe(b.author)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(b);
    }
    for (const g of groups.values()) {
      if (g.length > 1) for (const b of g) ids.add(b.trello_id);
    }
    return ids;
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
    if (physicalTodoOnly) {
      list = list.filter(
        (b) => b.status !== "finished" && (b.format === "physical" || b.format === "physical+ebook")
      );
    }
    if (specialEditionsOnly) list = list.filter((b) => b.special_edition);
    if (duplicatesOnly) list = list.filter((b) => duplicateIds.has(b.trello_id));

    const sorted = [...list];
    if (sortKey) {
      const cmp = COMPARATORS[sortKey];
      sorted.sort((a, b) => (sortDir === "asc" ? cmp(a, b) : -cmp(a, b)));
    } else {
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
    physicalTodoOnly,
    specialEditionsOnly,
    duplicatesOnly,
    duplicateIds,
    sortKey,
    sortDir,
  ]);

  function resetFilters() {
    setStatus("");
    setGenre("");
    setSeries("");
    setWorld("");
    setMood("");
    setFormat("");
    setIncompleteOnly(false);
    setNeedsReviewOnly(false);
    setPhysicalTodoOnly(false);
    setSpecialEditionsOnly(false);
    setDuplicatesOnly(false);
  }

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir("asc");
    }
  }

  function renderTh(id: SortKey, label: string) {
    const active = sortKey === id;
    return (
      <th className="text-left px-3 py-2 font-semibold">
        <button
          type="button"
          onClick={() => toggleSort(id)}
          className="flex items-center gap-1 hover:text-ink"
        >
          {label}
          <span className={"text-brass " + (active ? "" : "opacity-0")}>
            {sortDir === "asc" ? "▲" : "▼"}
          </span>
        </button>
      </th>
    );
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

      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        resultsLabel={books ? `Showing ${filtered.length} of ${books.length} books` : undefined}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
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
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={incompleteOnly}
                onChange={(e) => setIncompleteOnly(e.target.checked)}
              />
              Missing data only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={needsReviewOnly}
                onChange={(e) => setNeedsReviewOnly(e.target.checked)}
              />
              Needs review ({reviewBooks.length})
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={physicalTodoOnly}
                onChange={(e) => setPhysicalTodoOnly(e.target.checked)}
              />
              📦 Physical, unread
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={specialEditionsOnly}
                onChange={(e) => setSpecialEditionsOnly(e.target.checked)}
              />
              ✨ Special editions
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={duplicatesOnly}
                onChange={(e) => setDuplicatesOnly(e.target.checked)}
              />
              🔁 Possible duplicates
            </label>
            <button className="btn btn-secondary ml-auto" onClick={resetFilters} type="button">
              Reset filters
            </button>
          </div>
        </div>
      </SearchFilterBar>

      {error && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      {!books && !error && <p className="text-stone-500">Loading your shelf…</p>}

      {books && (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2 font-semibold"></th>
                <th className="text-left px-3 py-2 font-semibold"></th>
                {renderTh("title", "Title")}
                {renderTh("author", "Author")}
                {renderTh("series", "Series")}
                {renderTh("genre", "Genre")}
                {renderTh("status", "Status")}
                {renderTh("pages", "Pages")}
                {renderTh("rating", "Rating")}
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
                        <span title="Missing genre, page count, or (for a physical copy) cover type">
                          ⚠️
                        </span>
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
