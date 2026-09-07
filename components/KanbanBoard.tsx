"use client";

import { useMemo, useRef, useState } from "react";
import type { Book, BookStatus } from "@/lib/types";
import BookDetail from "@/components/BookDetail";
import BookCover from "@/components/BookCover";

// Bar colors resolve through the same theme variables as the rest of the
// app (see tailwind.config.ts / globals.css) instead of fixed hex values,
// so they repaint correctly across all six color themes rather than only
// looking right in Parchment.
const COLUMNS: { id: BookStatus; label: string; sub: string; bar: string }[] = [
  { id: "wishlist", label: "Wishlist", sub: "Don't own it yet", bar: "rgb(var(--color-brass))" },
  { id: "to_read", label: "To Read", sub: "Owned, unread", bar: "rgb(var(--stone-400))" },
  { id: "reading", label: "Reading", sub: "In progress", bar: "rgb(var(--board-reading))" },
  { id: "finished", label: "Finished", sub: "Read it", bar: "rgb(var(--stone-600))" },
];

// The drag-and-drop Kanban view — originally its own page, now embedded on
// the Dashboard. `books` is the full set (for correct ordering math even
// while a search/filter narrows what's shown); `filter` controls which
// cards actually render.
export default function KanbanBoard({
  books,
  onBookUpdated,
  onBookDeleted,
  filter,
}: {
  books: Book[];
  onBookUpdated: (b: Book) => void;
  onBookDeleted: (id: string) => void;
  filter?: (b: Book) => boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Book | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const dragIdRef = useRef<string | null>(null);
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const byStatus = useMemo(() => {
    const map: Record<string, Book[]> = { wishlist: [], to_read: [], reading: [], finished: [] };
    for (const b of books) {
      (map[b.status] || map.to_read).push(b);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.board_pos - b.board_pos);
    }
    return map;
  }, [books]);

  function computeNewPos(colId: string, excludeId: string, clientY: number): number {
    const container = colRefs.current[colId];
    const list = byStatus[colId] || [];
    if (!container) return list.length ? list[list.length - 1].board_pos + 1 : 0;

    const cardEls = Array.from(
      container.querySelectorAll<HTMLElement>("[data-card-id]")
    ).filter((el) => el.dataset.cardId !== excludeId);

    let beforeId: string | null = null;
    for (const el of cardEls) {
      const rect = el.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        beforeId = el.dataset.cardId!;
        break;
      }
    }

    const siblings = list.filter((b) => b.trello_id !== excludeId);
    if (beforeId) {
      const idx = siblings.findIndex((b) => b.trello_id === beforeId);
      const beforeBook = siblings[idx];
      const prevBook = idx > 0 ? siblings[idx - 1] : null;
      const lo = prevBook ? prevBook.board_pos : beforeBook.board_pos - 1;
      return (lo + beforeBook.board_pos) / 2;
    }
    const last = siblings[siblings.length - 1];
    return last ? last.board_pos + 1 : 0;
  }

  async function moveBook(book: Book, newStatus: BookStatus, clientY: number) {
    const newPos = computeNewPos(newStatus, book.trello_id, clientY);
    const now = new Date().toISOString();
    const patch: Record<string, any> = { status: newStatus, board_pos: newPos };
    if (newStatus === "reading" && book.status !== "reading" && !book.date_started) {
      patch.date_started = now;
    }
    if (newStatus === "finished" && book.status !== "finished") {
      patch.date_finished = now;
    }
    if (newStatus === "wishlist") patch.owned = false;
    if (newStatus !== "wishlist" && !book.owned) patch.owned = true;

    const optimistic: Book = { ...book, ...patch };
    onBookUpdated(optimistic);

    try {
      const res = await fetch(`/api/books/${book.trello_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to save move");
      const updated = await res.json();
      onBookUpdated(updated);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const fullList = byStatus[col.id] || [];
          const list = filter ? fullList.filter(filter) : fullList;
          const colIndex = COLUMNS.findIndex((c) => c.id === col.id);
          const prevCol = COLUMNS[colIndex - 1];
          const nextCol = COLUMNS[colIndex + 1];
          return (
            <div
              key={col.id}
              className="flex-1 min-w-[16rem] bg-stone-100 rounded-xl border border-stone-200 flex flex-col max-h-[calc(100vh-320px)] min-h-[220px]"
            >
              <div className="px-3 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-sm flex-none"
                    style={{ background: col.bar }}
                  />
                  <span className="font-semibold text-sm text-ink flex-1">{col.label}</span>
                  <span className="text-xs font-mono text-stone-400">{list.length}</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">{col.sub}</p>
              </div>
              <div
                ref={(el) => {
                  colRefs.current[col.id] = el;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCol(col.id);
                }}
                onDragLeave={() => setDragOverCol((c) => (c === col.id ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverCol(null);
                  const id = dragIdRef.current;
                  const book = books.find((b) => b.trello_id === id);
                  if (book) moveBook(book, col.id, e.clientY);
                }}
                className={
                  "flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[100px] rounded-b-xl " +
                  (dragOverCol === col.id ? "bg-emerald-50/60" : "")
                }
              >
                {list.map((b) => (
                  <div
                    key={b.trello_id}
                    data-card-id={b.trello_id}
                    draggable
                    onDragStart={() => {
                      dragIdRef.current = b.trello_id;
                      setDraggingId(b.trello_id);
                    }}
                    onDragEnd={() => {
                      dragIdRef.current = null;
                      setDraggingId(null);
                    }}
                    onClick={() => setViewing(b)}
                    className={
                      "flex gap-2 bg-surface border border-stone-200 rounded-lg p-2 shadow-sm cursor-grab active:cursor-grabbing " +
                      (draggingId === b.trello_id ? "opacity-30" : "")
                    }
                  >
                    <BookCover
                      book={b}
                      className="w-8 h-12 rounded"
                      padding="p-1"
                      textSize="text-[7px]"
                      lineClamp="line-clamp-4"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-ink leading-tight line-clamp-2">
                        {b.title}
                      </p>
                      {b.author && (
                        <p className="text-[11px] text-stone-500 truncate">{b.author}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {b.priority && (
                          <span className="badge bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0">
                            🔥
                          </span>
                        )}
                        {b.enrichment_status === "low_confidence" && (
                          <span
                            className="badge bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0"
                            title="Verify cover match"
                          >
                            🔍
                          </span>
                        )}
                        {b.pages && (
                          <span className="badge bg-stone-100 text-stone-600 text-[9px] px-1.5 py-0">
                            {b.pages}pg
                          </span>
                        )}
                        {b.special_edition && (
                          <span className="badge bg-brass/10 text-amber-900 text-[9px] px-1.5 py-0">
                            ✦
                          </span>
                        )}
                        {b.status === "finished" && b.my_rating && (
                          <span className="text-amber-600 text-[9px]">
                            {"★".repeat(b.my_rating)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Drag-and-drop doesn't work on touch devices, so these
                        buttons are the only way to move a card between
                        columns on mobile — kept visible (not hover-only)
                        for that reason, not just as a shortcut on desktop. */}
                    <div className="flex flex-col gap-0.5 flex-none">
                      <button
                        type="button"
                        title={prevCol ? `Move to ${prevCol.label}` : undefined}
                        aria-label={prevCol ? `Move to ${prevCol.label}` : undefined}
                        disabled={!prevCol}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (prevCol) moveBook(b, prevCol.id, Number.MAX_SAFE_INTEGER);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-200 disabled:opacity-0 disabled:pointer-events-none"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        title={nextCol ? `Move to ${nextCol.label}` : undefined}
                        aria-label={nextCol ? `Move to ${nextCol.label}` : undefined}
                        disabled={!nextCol}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (nextCol) moveBook(b, nextCol.id, Number.MAX_SAFE_INTEGER);
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-stone-500 hover:bg-stone-200 disabled:opacity-0 disabled:pointer-events-none"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                ))}
                {list.length === 0 && (
                  <p className="text-[11px] text-stone-400 text-center py-6">Nothing here.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}
