"use client";

import { useEffect, useMemo, useState } from "react";
import BookDetail from "@/components/BookDetail";
import type { Book } from "@/lib/types";

function normalize(s: string | null): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function DuplicatesPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Book | null>(null);

  useEffect(() => {
    fetch("/api/books")
      .then((res) => res.json())
      .then((data) => setBooks(data as Book[]))
      .catch((err) => setError(err.message));
  }, []);

  const duplicateGroups = useMemo(() => {
    if (!books) return [];
    const groups = new Map<string, Book[]>();
    for (const b of books) {
      const key = `${normalize(b.title)}::${normalize(b.author)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(b);
    }
    return Array.from(groups.values())
      .filter((g) => g.length > 1)
      .sort((a, b) => a[0].title.localeCompare(b[0].title));
  }, [books]);

  function applySaved(updated: Book) {
    setBooks((prev) =>
      prev ? prev.map((b) => (b.trello_id === updated.trello_id ? updated : b)) : prev
    );
  }

  function handleDeleted(id: string) {
    setBooks((prev) => (prev ? prev.filter((b) => b.trello_id !== id) : prev));
    setViewing(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Duplicates</h1>
        <p className="text-sm text-stone-500">
          {duplicateGroups.length} possible duplicate{duplicateGroups.length === 1 ? "" : "s"} —
          matched by title + author.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      {!books && !error && <p className="text-stone-500">Loading…</p>}

      {books && (
        <div className="space-y-3">
          {duplicateGroups.map((group, i) => (
            <div key={i} className="card">
              <p className="font-medium text-ink mb-2">
                {group[0].title}
                {group[0].author ? ` — ${group[0].author}` : ""}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.map((b) => (
                  <button
                    key={b.trello_id}
                    onClick={() => setViewing(b)}
                    className="text-left text-sm rounded-md border border-stone-200 px-3 py-2 text-stone-600 hover:bg-parchment/60 hover:border-stone-300 transition-colors"
                  >
                    <p>Status: {b.status.replace(/_/g, " ")}</p>
                    <p>Format: {b.format || "—"}</p>
                    <p>Genre: {b.genre || "—"}</p>
                    <p>Pages: {b.pages ?? "—"}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {duplicateGroups.length === 0 && (
            <p className="text-stone-400">No duplicates found — your shelf is clean!</p>
          )}
        </div>
      )}

      {viewing && (
        <BookDetail
          book={viewing}
          onClose={() => setViewing(null)}
          onSaved={applySaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
