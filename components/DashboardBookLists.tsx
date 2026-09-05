"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Book } from "@/lib/types";
import BookDetail from "./BookDetail";

export default function DashboardBookLists({
  readNext,
  currentlyReading,
}: {
  readNext: { series: string; book: Book; reason: string }[];
  currentlyReading: [string, Book[]][];
}) {
  const router = useRouter();
  const [viewing, setViewing] = useState<Book | null>(null);

  function closeAndRefresh() {
    setViewing(null);
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card">
        <h2 className="font-semibold text-ink mb-3">📖 Currently Reading</h2>
        {currentlyReading.length === 0 && (
          <p className="text-sm text-stone-500">Nothing in progress right now.</p>
        )}
        <ul className="space-y-2">
          {currentlyReading.map(([series, list]) => (
            <li key={series}>
              <p className="text-xs uppercase tracking-wide text-stone-400">{series}</p>
              {list.map((b) => (
                <button
                  key={b.trello_id}
                  onClick={() => setViewing(b)}
                  type="button"
                  className="block text-left text-sm text-ink hover:text-brass hover:underline"
                >
                  {b.title}
                  {b.author && <span className="text-stone-500"> — {b.author}</span>}
                </button>
              ))}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="font-semibold text-ink mb-3">➡️ Read Next by Series</h2>
        {readNext.length === 0 && (
          <p className="text-sm text-stone-500">
            No series with a book already finished have a next book ready to go.
          </p>
        )}
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {readNext.map((entry) => (
            <li key={entry.series} className="text-sm">
              <button
                onClick={() => setViewing(entry.book)}
                type="button"
                className="font-medium text-ink hover:text-brass hover:underline text-left"
              >
                {entry.book.title}
              </button>
              <p className="text-xs text-stone-500">{entry.reason}</p>
            </li>
          ))}
        </ul>
      </div>

      {viewing && (
        <BookDetail
          book={viewing}
          onClose={() => setViewing(null)}
          onSaved={closeAndRefresh}
          onDeleted={closeAndRefresh}
        />
      )}
    </div>
  );
}
