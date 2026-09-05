"use client";

import { useState } from "react";
import {
  GENRES,
  STATUSES,
  FORMATS,
  COVER_TYPES,
  SERIES_POSITIONS,
  type Book,
} from "@/lib/types";
import MoodPicker from "./MoodPicker";
import WorldPicker from "./WorldPicker";
import BookCover from "./BookCover";

type FormState = {
  title: string;
  author: string;
  genre: string;
  series: string;
  series_index: string;
  series_position: string;
  pages: string;
  status: string;
  owned: boolean;
  format: string;
  cover_type: string;
  special_edition: boolean;
  my_rating: string;
  moods: string[];
  worlds: string[];
  priority: boolean;
  date_started: string;
  date_finished: string;
  description: string;
  isbn: string;
  cover_url: string;
};

// `seed` pre-fills a brand-new book (e.g. from a barcode scan's Google Books
// lookup) without switching the form into edit mode — it's only consulted
// when there's no existing `book` to edit.
function toFormState(b?: Book | null, seed?: Partial<Book> | null): FormState {
  const src = b ?? seed ?? null;
  return {
    title: src?.title ?? "",
    author: src?.author ?? "",
    genre: src?.genre ?? "",
    series: src?.series ?? "",
    series_index: src?.series_index?.toString() ?? "",
    series_position: src?.series_position ?? "",
    pages: src?.pages?.toString() ?? "",
    status: b?.status ?? "to_read",
    owned: b?.owned ?? true,
    format: src?.format ?? "",
    cover_type: src?.cover_type ?? "",
    special_edition: b?.special_edition ?? false,
    my_rating: b?.my_rating?.toString() ?? "",
    moods: b?.moods ?? [],
    worlds: src?.worlds ?? [],
    priority: b?.priority ?? false,
    date_started: b?.date_started?.slice(0, 10) ?? "",
    date_finished: b?.date_finished?.slice(0, 10) ?? "",
    description: src?.description ?? "",
    isbn: src?.isbn ?? "",
    cover_url: src?.cover_url ?? "",
  };
}

export default function BookForm({
  book,
  seed,
  onSaved,
  onCancel,
  onDeleted,
}: {
  book?: Book | null;
  seed?: Partial<Book> | null;
  onSaved: (b: Book) => void;
  onCancel: () => void;
  onDeleted?: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(toFormState(book, seed));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetching, setRefetching] = useState(false);
  const [refetchMsg, setRefetchMsg] = useState<string | null>(null);
  const isEdit = !!book;
  const allowsCoverType = form.format === "physical" || form.format === "physical+ebook";

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload: any = {
      title: form.title.trim(),
      author: form.author.trim() || null,
      genre: form.genre || null,
      series: form.series.trim() || null,
      series_index: form.series_index ? parseInt(form.series_index, 10) : null,
      series_position: form.series_position || null,
      pages: form.pages ? parseInt(form.pages, 10) : null,
      status: form.status,
      owned: form.owned,
      format: form.format || null,
      cover_type: allowsCoverType ? form.cover_type || null : null,
      special_edition: form.special_edition,
      my_rating: form.my_rating ? parseInt(form.my_rating, 10) : null,
      moods: form.moods,
      worlds: form.worlds,
      priority: form.priority,
      date_started: form.date_started ? new Date(form.date_started).toISOString() : null,
      date_finished: form.date_finished ? new Date(form.date_finished).toISOString() : null,
      description: form.description.trim() || null,
      isbn: form.isbn.trim() || null,
      cover_url: form.cover_url.trim() || null,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/books/${book!.trello_id}` : "/api/books",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save book");
      onSaved(data as Book);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRefetch() {
    if (!book) return;
    setRefetching(true);
    setRefetchMsg(null);
    try {
      const res = await fetch(`/api/books/${book.trello_id}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      if (data.book) {
        setForm((f) => ({
          ...f,
          cover_url: data.book.cover_url ?? f.cover_url,
          description: data.book.description ?? f.description,
          isbn: data.book.isbn ?? f.isbn,
        }));
      }
      setRefetchMsg(
        data.status === "matched"
          ? "✓ Found a match on Google Books — cover, description, and ISBN updated below."
          : data.status === "low_confidence"
          ? "⚠️ Found a possible match, but not a confident one — double-check the cover and description below."
          : "No match found on Google Books for this title/author."
      );
    } catch (err: any) {
      setRefetchMsg(err.message);
    } finally {
      setRefetching(false);
    }
  }

  async function handleDelete() {
    if (!book) return;
    if (!confirm(`Delete "${book.title}"? This can't be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/books/${book.trello_id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      onDeleted?.(book.trello_id);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      {isEdit && (
        <div className="flex items-center gap-3 rounded-md border border-stone-200 p-2.5">
          <BookCover
            book={{ title: form.title || "Untitled", author: form.author || null, cover_url: form.cover_url || null }}
            className="w-10 h-14"
            padding="p-1"
            textSize="text-[6px]"
            lineClamp="line-clamp-4"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-stone-500">
              {book?.enrichment_status === "matched" && "✓ Matched via Google Books"}
              {book?.enrichment_status === "low_confidence" &&
                "⚠️ Low-confidence match — verify the cover/description"}
              {book?.enrichment_status === "not_found" && "No Google Books match found yet"}
              {book?.enrichment_status === "error" && "⚠️ Lookup failed — try Refetch"}
              {!book?.enrichment_status && "Not checked against Google Books yet"}
            </p>
            {refetchMsg && <p className="text-xs text-stone-600 mt-0.5">{refetchMsg}</p>}
          </div>
          <button
            type="button"
            className="btn btn-secondary flex-none"
            onClick={handleRefetch}
            disabled={refetching}
          >
            {refetching ? "Checking…" : "🔍 Refetch"}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Title *</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label">Author</label>
          <input
            className="input"
            value={form.author}
            onChange={(e) => set("author", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Genre</label>
          <select
            className="input"
            value={form.genre}
            onChange={(e) => set("genre", e.target.value)}
          >
            <option value="">—</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Series</label>
          <input
            className="input"
            value={form.series}
            onChange={(e) => set("series", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Series #</label>
          <input
            type="number"
            className="input"
            value={form.series_index}
            onChange={(e) => set("series_index", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Series Position</label>
          <select
            className="input"
            value={form.series_position}
            onChange={(e) => set("series_position", e.target.value)}
          >
            <option value="">—</option>
            {SERIES_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Page Count</label>
          <input
            type="number"
            min={1}
            className="input"
            placeholder="e.g. 384"
            value={form.pages}
            onChange={(e) => set("pages", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Format</label>
          <select
            className="input"
            value={form.format}
            onChange={(e) => {
              set("format", e.target.value);
              if (e.target.value !== "physical" && e.target.value !== "physical+ebook") {
                set("cover_type", "");
              }
            }}
          >
            <option value="">—</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {allowsCoverType && (
          <div>
            <label className="label">Cover Type</label>
            <select
              className="input"
              value={form.cover_type}
              onChange={(e) => set("cover_type", e.target.value)}
            >
              <option value="">—</option>
              {COVER_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">My Rating</label>
          <select
            className="input"
            value={form.my_rating}
            onChange={(e) => set("my_rating", e.target.value)}
          >
            <option value="">—</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">ISBN</label>
          <input
            className="input"
            value={form.isbn}
            onChange={(e) => set("isbn", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Cover Image URL</label>
          <input
            className="input"
            placeholder="https://…"
            value={form.cover_url}
            onChange={(e) => set("cover_url", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Date Started</label>
          <input
            type="date"
            className="input"
            value={form.date_started}
            onChange={(e) => set("date_started", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Date Finished</label>
          <input
            type="date"
            className="input"
            value={form.date_finished}
            onChange={(e) => set("date_finished", e.target.value)}
          />
        </div>

        <div className="sm:col-span-2 flex flex-wrap gap-5 pt-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.owned}
              onChange={(e) => set("owned", e.target.checked)}
            />
            Owned
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.special_edition}
              onChange={(e) => set("special_edition", e.target.checked)}
            />
            Special Edition
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.priority}
              onChange={(e) => set("priority", e.target.checked)}
            />
            Priority
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Worlds</label>
          <WorldPicker value={form.worlds} onChange={(w) => set("worlds", w)} />
        </div>

        <div className="sm:col-span-2">
          <MoodPicker value={form.moods} onChange={(m) => set("moods", m)} />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea
            className="input"
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="btn btn-danger"
            >
              Delete
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Book"}
          </button>
        </div>
      </div>
    </form>
  );
}
