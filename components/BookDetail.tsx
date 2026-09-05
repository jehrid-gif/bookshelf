"use client";

import { useState } from "react";
import type { Book } from "@/lib/types";
import BookForm from "./BookForm";
import BookCover from "./BookCover";
import Modal from "./Modal";

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
}: {
  book: Book;
  initialMode?: "view" | "edit";
  onClose: () => void;
  onSaved: (b: Book) => void;
  onDeleted: (id: string) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
  const [current, setCurrent] = useState<Book>(book);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            <div className="text-xs text-stone-500 flex gap-4">
              {current.date_started && (
                <span>Started {new Date(current.date_started).toLocaleDateString()}</span>
              )}
              {current.date_finished && (
                <span>Finished {new Date(current.date_finished).toLocaleDateString()}</span>
              )}
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
