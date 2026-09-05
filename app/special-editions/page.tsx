"use client";

import { useEffect, useMemo, useState } from "react";
import BookDetail from "@/components/BookDetail";
import type { Book } from "@/lib/types";

export default function SpecialEditionsPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Book | null>(null);

  useEffect(() => {
    fetch("/api/books")
      .then((res) => res.json())
      .then((data) => setBooks(data as Book[]))
      .catch((err) => setError(err.message));
  }, []);

  const list = useMemo(() => {
    if (!books) return [];
    return books
      .filter((b) => b.special_edition)
      .sort((a, b) => a.title.localeCompare(b.title));
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
        <h1 className="text-xl font-bold text-ink">Special Editions</h1>
        <p className="text-sm text-stone-500">{list.length} special editions on the shelf.</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      {!books && !error && <p className="text-stone-500">Loading…</p>}

      {books && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((b) => (
            <button
              key={b.trello_id}
              onClick={() => setViewing(b)}
              className="card text-left hover:bg-parchment/60 transition-colors"
            >
              <p className="font-medium text-ink">{b.title}</p>
              {b.author && <p className="text-sm text-stone-600">{b.author}</p>}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {b.cover_type && (
                  <span className="badge bg-stone-100 text-stone-700">{b.cover_type}</span>
                )}
                {b.genre && <span className="badge bg-stone-100 text-stone-700">{b.genre}</span>}
                {b.series && (
                  <span className="badge bg-stone-100 text-stone-700">
                    {b.series}
                    {b.series_index ? ` #${b.series_index}` : ""}
                  </span>
                )}
              </div>
            </button>
          ))}
          {list.length === 0 && (
            <p className="text-stone-400 col-span-full">No special editions marked yet.</p>
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
