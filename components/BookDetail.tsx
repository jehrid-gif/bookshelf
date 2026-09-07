"use client";

import { useEffect, useState } from "react";
import type { Book } from "@/lib/types";
import BookForm from "./BookForm";
import BookCover from "./BookCover";
import Modal from "./Modal";

function daysBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

const STATUS_LABEL: Record<string, string> = {
  to_read: "To Read",
  reading: "Reading",
  finished: "Finished",
  wishlist: "Wishlist",
};

export default function BookDetail({
  book,
  initialMode = "view",
  onClose,
  onSaved,
  onDeleted,
  onReadAgain,
}: {
  book: Book;
  initialMode?: "view" | "edit";
  onClose: () => void;
  onSaved: (b: Book) => void;
  onDeleted: (id: string) => void;
  onReadAgain?: (b: Book) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [current, setCurrent] = useState<Book>(book);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Book[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    fetch(`/api/books/${current.trello_id}/history`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setHistory(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
    // Only the identity of the book changes what history could mean —
    // re-fetch when a save swaps `current` for a different row (e.g. Read
    // Again closes this modal, but re-opening a different book should not
    // reuse a stale chain).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.trello_id]);

  async function handleDelete() {
    if (!confirm(`Delete "${current.title}"? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/books/${current.trello_id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      onDeleted(current.trello_id);
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <Modal title={mode === "edit" ? "Edit Book" : current.title} onClose={onClose}>
      {mode === "edit" ? (
        <BookForm
          book={current}
          onSaved={(b) => {
            setCurrent(b);
            onSaved(b);
            setMode("view");
          }}
          onCancel={() => setMode("view")}
          onDeleted={onDeleted}
          onReadAgain={
            onReadAgain &&
            ((b) => {
              onReadAgain(b);
              onClose();
            })
          }
        />
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
          )}

          <div className="flex gap-4">
            <BookCover book={current} className="w-16 h-24" />
            <div className="min-w-0 flex-1">
              {current.author && <p className="text-sm text-stone-600">{current.author}</p>}
              {current.series && (
                <p className="text-xs text-stone-500 mt-0.5">
                  {current.series}
                  {current.series_index ? ` #${current.series_index}` : ""}
                  {current.series_position
                    ? ` · ${current.series_position.replace(/_/g, " ")}`
                    : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="badge bg-stone-100 text-stone-700">
                  {STATUS_LABEL[current.status]}
                </span>
                {current.genre && (
                  <span className="badge bg-stone-100 text-stone-700">{current.genre}</span>
                )}
                {current.pages && (
                  <span className="badge bg-stone-100 text-stone-700">{current.pages}pg</span>
                )}
                {current.format && (
                  <span className="badge bg-stone-100 text-stone-700">{current.format}</span>
                )}
                {current.cover_type && (
                  <span className="badge bg-stone-100 text-stone-700">{current.cover_type}</span>
                )}
                {current.special_edition && (
                  <span className="badge bg-brass/10 text-amber-900">✦ special edition</span>
                )}
                {current.priority && (
                  <span className="badge bg-amber-100 text-amber-800">🔥 priority</span>
                )}
                {!current.owned && (
                  <span className="badge bg-stone-100 text-stone-700">not owned</span>
                )}
                {current.enrichment_status === "low_confidence" && (
                  <span
                    className="badge bg-amber-100 text-amber-800"
                    title="The cover/description below came from a Google Books match we weren't fully sure about — worth a quick check."
                  >
                    🔍 verify cover match
                  </span>
                )}
              </div>
              {current.my_rating && (
                <p className="text-amber-600 mt-2 text-base leading-none">
                  {"★".repeat(current.my_rating)}
                </p>
              )}
            </div>
          </div>

          {(current.date_started || current.date_finished) && (
            <div className="text-xs text-stone-500 flex gap-4 flex-wrap">
              {current.date_started && (
                <span>Started {new Date(current.date_started).toLocaleDateString()}</span>
              )}
              {current.date_finished && (
                <span>Finished {new Date(current.date_finished).toLocaleDateString()}</span>
              )}
              {current.date_started && current.date_finished && (
                <span>
                  {daysBetween(current.date_started, current.date_finished)} day
                  {daysBetween(current.date_started, current.date_finished) === 1 ? "" : "s"} to
                  finish
                </span>
              )}
            </div>
          )}

          {history && history.length > 1 && (
            <div>
              <p className="label">
                Read {history.length} time{history.length === 1 ? "" : "s"}
              </p>
              <ul className="space-y-1">
                {history.map((h) => (
                  <li
                    key={h.trello_id}
                    className={
                      "flex items-center justify-between gap-2 text-sm rounded-md px-2 py-1 " +
                      (h.trello_id === current.trello_id ? "bg-parchment/60" : "")
                    }
                  >
                    <span className="text-stone-600">
                      {h.date_started ? new Date(h.date_started).toLocaleDateString() : "—"}
                      {" – "}
                      {h.status === "finished" && h.date_finished
                        ? new Date(h.date_finished).toLocaleDateString()
                        : h.status === "reading"
                        ? "in progress"
                        : "—"}
                    </span>
                    {h.my_rating ? (
                      <span className="text-amber-600 flex-none">{"★".repeat(h.my_rating)}</span>
                    ) : (
                      <span className="text-stone-400 flex-none text-xs">unrated</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {current.worlds.length > 0 && (
            <div>
              <p className="label">Worlds</p>
              <div className="flex flex-wrap gap-1.5">
                {current.worlds.map((w) => (
                  <span
                    key={w}
                    className="badge bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {current.moods.length > 0 && (
            <div>
              <p className="label">Moods</p>
              <div className="flex flex-wrap gap-1.5">
                {current.moods.map((m) => (
                  <span key={m} className="badge bg-brass/10 text-amber-900">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {current.description && (
            <div>
              <p className="label">Description</p>
              <p className="text-sm text-stone-700 whitespace-pre-wrap">
                {current.description}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={deleting}
              type="button"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={onClose} type="button">
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setMode("edit")}
                type="button"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
