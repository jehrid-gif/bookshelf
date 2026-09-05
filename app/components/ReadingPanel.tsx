"use client";

import { useState } from "react";
import type { Book } from "@/lib/types";
import SidePanel from "./SidePanel";
import BookDetail from "./BookDetail";

export default function ReadingPanel({
  books,
  onClose,
  onBookUpdated,
  onBookDeleted,
}: {
  books: Book[];
  onClose: () => void;
  onBookUpdated: (b: Book) => void;
  onBookDeleted: (id: string) => void;
}) {
  const [viewing, setViewing] = useState<Book | null>(null);

  const sorted = [...books].sort((a, b) => {
    const at = a.date_started ? new Date(a.date_started).getTime() : 0;
    const bt = b.date_started ? new Date(b.date_started).getTime() : 0;
    return bt - at;
  });

  return (
    <SidePanel title="📖 Currently Reading" onClose={onClose}>
      {sorted.length === 0 && (
        <p className="text-sm text-stone-500">Nothing in progress right now.</p>
      )}
      <ul className="space-y-3">
        {sorted.map((b) => (
          <li key={b.trello_id} className="border-b border-stone-100 pb-3 last:border-0">
            <button
              onClick={() => setViewing(b)}
              type="button"
              className="block text-left font-medium text-ink hover:text-brass hover:underline"
            >
              {b.title}
            </button>
            {b.author && <p className="text-sm text-stone-500">{b.author}</p>}
            {b.series && (
              <p className="text-xs text-stone-500">
                {b.series}
                {b.series_index ? ` #${b.series_index}` : ""}
              </p>
            )}
            <p className="text-xs text-stone-400 mt-1">
              {b.date_started
                ? `Started ${new Date(b.date_started).toLocaleDateString()}`
                : "Start date not recorded"}
            </p>
          </li>
        ))}
      </ul>

      {viewing && (
        <BookDetail
          book={viewing}
          onClose={() => setViewing(null)}
          onSaved={(b) => {
            onBookUpdated(b);
            setViewing(b);
          }}
          onDeleted={(id) => {
            onBookDeleted(id);
            setViewing(null);
          }}
        />
      )}
    </SidePanel>
  );
}
