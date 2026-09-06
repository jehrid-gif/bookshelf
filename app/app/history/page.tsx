"use client";

import { useEffect, useState } from "react";

interface BookChange {
  id: string;
  book_id: string;
  book_title: string;
  action: "created" | "updated" | "deleted";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changed_fields: string[];
  undone_at: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  author: "Author",
  genre: "Genre",
  series: "Series",
  series_index: "Series #",
  series_position: "Series Position",
  pages: "Pages",
  status: "Status",
  owned: "Owned",
  format: "Format",
  cover_type: "Cover Type",
  special_edition: "Special Edition",
  my_rating: "Rating",
  moods: "Moods",
  worlds: "Worlds",
  priority: "Priority",
  date_added: "Date Added",
  date_started: "Date Started",
  date_finished: "Date Finished",
  description: "Description",
  cover_url: "Cover Image",
  isbn: "ISBN",
};

const STATUS_LABEL: Record<string, string> = {
  to_read: "To Read",
  reading: "Reading",
  finished: "Finished",
  wishlist: "Wishlist",
};

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "status" && typeof value === "string") return STATUS_LABEL[value] ?? value;
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (
    (field.startsWith("date_") || field === "created_at" || field === "updated_at") &&
    typeof value === "string"
  ) {
    return value.slice(0, 10);
  }
  return String(value);
}

const ACTION_LABEL: Record<BookChange["action"], string> = {
  created: "➕ Added",
  updated: "✏️ Changed",
  deleted: "🗑️ Deleted",
};

export default function HistoryPage() {
  const [changes, setChanges] = useState<BookChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/changes")
      .then((res) => res.json())
      .then((data) => setChanges(data))
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUndo(id: string) {
    setUndoingId(id);
    setUndoError(null);
    try {
      const res = await fetch(`/api/admin/changes/${id}/undo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Undo failed.");
      load();
    } catch (err: any) {
      setUndoError(err.message);
    } finally {
      setUndoingId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">🕘 Change Log</h1>
        <p className="text-sm text-stone-500 mt-1">
          Every add, edit, and delete made in the app, most recent first —
          drag-to-reorder on the board isn't included since it doesn't change
          any actual book data. Click Undo to reverse just that one change,
          even if other edits have happened to the book since.
        </p>
      </div>

      {error && <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
      {undoError && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{undoError}</div>
      )}

      {!changes && !error && <p className="text-stone-500">Loading…</p>}

      {changes && changes.length === 0 && (
        <p className="text-stone-500">Nothing logged yet — make a change and it'll show up here.</p>
      )}

      {changes && changes.length > 0 && (
        <ul className="space-y-2">
          {changes.map((c) => (
            <li key={c.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{ACTION_LABEL[c.action]}</span>{" "}
                    <span className="font-medium">{c.book_title}</span>
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {new Date(c.created_at).toLocaleString()}
                  </p>

                  {c.action === "updated" && c.changed_fields.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {c.changed_fields.map((f) => (
                        <li key={f} className="text-xs text-stone-600">
                          <span className="font-medium">{FIELD_LABELS[f] ?? f}:</span>{" "}
                          {formatValue(f, c.before?.[f])} → {formatValue(f, c.after?.[f])}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex-none">
                  {c.undone_at ? (
                    <span className="text-xs text-stone-400 italic">Undone</span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={undoingId === c.id}
                      onClick={() => handleUndo(c.id)}
                    >
                      {undoingId === c.id ? "Undoing…" : "Undo"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
