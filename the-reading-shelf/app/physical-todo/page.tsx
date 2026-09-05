"use client";

import { useEffect, useMemo, useState } from "react";
import BookDetail from "@/components/BookDetail";
import type { Book } from "@/lib/types";

export default function PhysicalTodoPage() {
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
      .filter(
        (b) =>
          b.status !== "finished" &&
          (b.format === "physical" || b.format === "physical+ebook")
      )
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority ? -1 : 1;
        const s = (a.series || "").localeCompare(b.series || "");
        if (s !== 0) return s;
        return (a.series_index || 0) - (b.series_index || 0) || a.title.localeCompare(b.title);
      });
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
        <h1 className="text-xl font-bold text-ink">Physical Books What Need Readin'</h1>
        <p className="text-sm text-stone-500">
          Physical books on the shelf that aren't finished yet — {list.length} total.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}

      {!books && !error && <p className="text-stone-500">Loading…</p>}

      {books && (
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2 font-semibold"></th>
                <th className="text-left px-3 py-2 font-semibold">Title</th>
                <th className="text-left px-3 py-2 font-semibold">Author</th>
                <th className="text-left px-3 py-2 font-semibold">Series</th>
                <th className="text-left px-3 py-2 font-semibold">Genre</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">Cover</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr
                  key={b.trello_id}
                  className="border-t border-stone-100 hover:bg-parchment/50 cursor-pointer"
                  onClick={() => setViewing(b)}
                >
                  <td className="px-3 py-2">{b.priority && <span title="Priority">🔥</span>}</td>
                  <td className="px-3 py-2 font-medium text-ink">{b.title}</td>
                  <td className="px-3 py-2 text-stone-600">{b.author || "—"}</td>
                  <td className="px-3 py-2 text-stone-600">
                    {b.series ? `${b.series}${b.series_index ? ` #${b.series_index}` : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{b.genre || "—"}</td>
                  <td className="px-3 py-2 text-stone-600">
                    {b.status === "reading" ? "Reading" : "To Read"}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{b.cover_type || "—"}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-stone-400">
                    Nothing here — every physical book is finished!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
