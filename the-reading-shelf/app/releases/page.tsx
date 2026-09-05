"use client";

import { useEffect, useMemo, useState } from "react";
import type { UpcomingRelease } from "@/lib/types";

interface WatchedAuthor {
  id: number;
  name: string;
  created_at: string;
}

// Mirrors the "round down" upcoming check in lib/releases.ts, kept separate
// here since that file also pulls in the pg-based db client and can't be
// imported into a client component.
function isFuture(raw: string | null): boolean {
  if (!raw) return false;
  const parts = raw.split("-").map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return false;
  const [year, month, day] = parts;
  const d =
    day !== undefined
      ? new Date(Date.UTC(year, month - 1, day))
      : month !== undefined
      ? new Date(Date.UTC(year, month - 1, 1))
      : new Date(Date.UTC(year, 0, 1));
  return d.getTime() >= Date.now();
}

function formatDate(raw: string | null): string {
  if (!raw) return "Date unknown";
  const parts = raw.split("-");
  if (parts.length === 3) {
    return new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2])).toLocaleDateString(
      undefined,
      { year: "numeric", month: "long", day: "numeric" }
    );
  }
  if (parts.length === 2) {
    return new Date(Date.UTC(+parts[0], +parts[1] - 1, 1)).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
    });
  }
  return parts[0];
}

export default function ReleasesPage() {
  const [releases, setReleases] = useState<UpcomingRelease[] | null>(null);
  const [watched, setWatched] = useState<WatchedAuthor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [newAuthor, setNewAuthor] = useState("");
  const [addingAuthor, setAddingAuthor] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  async function loadReleases() {
    try {
      const res = await fetch("/api/releases");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load releases");
      setReleases(data as UpcomingRelease[]);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function loadWatched() {
    try {
      const res = await fetch("/api/watched-authors");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load watched authors");
      setWatched(data as WatchedAuthor[]);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadReleases();
    loadWatched();
  }, []);

  const { upcoming, recent } = useMemo(() => {
    const list = releases || [];
    return {
      upcoming: list.filter((r) => isFuture(r.published_date)),
      recent: list.filter((r) => !isFuture(r.published_date)),
    };
  }, [releases]);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/releases/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      setRefreshMsg(
        `Checked ${data.authorsChecked} author${data.authorsChecked === 1 ? "" : "s"} + Black Library, found ${data.upserted} release${data.upserted === 1 ? "" : "s"}.` +
          (data.errors.length ? ` (${data.errors.length} lookup error${data.errors.length === 1 ? "" : "s"})` : "")
      );
      await loadReleases();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAddAuthor(e: React.FormEvent) {
    e.preventDefault();
    if (!newAuthor.trim()) return;
    setAddingAuthor(true);
    try {
      const res = await fetch("/api/watched-authors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAuthor.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add author");
      setNewAuthor("");
      await loadWatched();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddingAuthor(false);
    }
  }

  async function handleRemoveAuthor(id: number) {
    try {
      const res = await fetch(`/api/watched-authors/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove author");
      }
      setWatched((prev) => (prev ? prev.filter((w) => w.id !== id) : prev));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddToWishlist(release: UpcomingRelease) {
    setBusyIds((prev) => new Set(prev).add(release.google_id));
    try {
      const res = await fetch(`/api/releases/${release.google_id}/add-to-wishlist`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add to wishlist");
      setReleases((prev) =>
        prev
          ? prev.map((r) =>
              r.google_id === release.google_id ? { ...r, added_to_wishlist: true } : r
            )
          : prev
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(release.google_id);
        return next;
      });
    }
  }

  async function handleDismiss(release: UpcomingRelease) {
    setBusyIds((prev) => new Set(prev).add(release.google_id));
    try {
      const res = await fetch(`/api/releases/${release.google_id}/dismiss`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to dismiss");
      }
      setReleases((prev) =>
        prev ? prev.filter((r) => r.google_id !== release.google_id) : prev
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(release.google_id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Upcoming Releases</h1>
          <p className="text-sm text-stone-500">
            New Sci-Fi/Fantasy from authors you follow, plus the full Black Library catalog.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "Checking Google Books…" : "🔄 Refresh now"}
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
      )}
      {refreshMsg && (
        <div className="rounded-md bg-emerald-50 text-emerald-800 text-sm px-3 py-2">
          {refreshMsg}
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold text-ink mb-1">Watched Authors</h2>
        <p className="text-xs text-stone-500 mb-3">
          Every author already in your library is watched automatically. Add anyone else here.
        </p>
        <form onSubmit={handleAddAuthor} className="flex gap-2 mb-3">
          <input
            className="input"
            placeholder="Add an author to watch…"
            value={newAuthor}
            onChange={(e) => setNewAuthor(e.target.value)}
          />
          <button className="btn btn-secondary" disabled={addingAuthor} type="submit">
            {addingAuthor ? "Adding…" : "+ Add"}
          </button>
        </form>
        {watched && watched.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {watched.map((w) => (
              <span
                key={w.id}
                className="badge bg-stone-100 text-stone-700 gap-1.5 pr-1"
              >
                {w.name}
                <button
                  onClick={() => handleRemoveAuthor(w.id)}
                  className="text-stone-400 hover:text-red-600 leading-none"
                  title="Stop watching"
                  type="button"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {watched && watched.length === 0 && (
          <p className="text-xs text-stone-400">No extra authors added yet.</p>
        )}
      </div>

      {!releases && !error && <p className="text-stone-500">Loading…</p>}

      {releases && (
        <>
          <ReleaseSection
            title={`📅 Upcoming (${upcoming.length})`}
            releases={upcoming}
            busyIds={busyIds}
            onAdd={handleAddToWishlist}
            onDismiss={handleDismiss}
            emptyText="Nothing forthcoming yet — try Refresh, or check back after tomorrow's automatic check."
          />
          <ReleaseSection
            title={`🆕 Recently Released (${recent.length})`}
            releases={recent}
            busyIds={busyIds}
            onAdd={handleAddToWishlist}
            onDismiss={handleDismiss}
            emptyText="Nothing released in the last month from your watched authors or Black Library."
          />
        </>
      )}
    </div>
  );
}

function ReleaseSection({
  title,
  releases,
  busyIds,
  onAdd,
  onDismiss,
  emptyText,
}: {
  title: string;
  releases: UpcomingRelease[];
  busyIds: Set<string>;
  onAdd: (r: UpcomingRelease) => void;
  onDismiss: (r: UpcomingRelease) => void;
  emptyText: string;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-ink">{title}</h2>
      {releases.length === 0 && <p className="text-sm text-stone-400">{emptyText}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {releases.map((r) => (
          <div key={r.google_id} className="card flex flex-col gap-2">
            <div className="flex gap-3">
              {r.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.cover_url}
                  alt=""
                  className="flex-none w-12 h-[72px] object-cover rounded shadow-sm"
                />
              ) : (
                <div className="flex-none w-12 h-[72px] rounded bg-stone-200" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink leading-tight">{r.title}</p>
                {r.author && <p className="text-sm text-stone-600 truncate">{r.author}</p>}
                <p className="text-xs text-stone-500 mt-0.5">{formatDate(r.published_date)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.is_black_library && (
                <span className="badge bg-red-50 text-red-800 border border-red-200">
                  Black Library
                </span>
              )}
              {r.matched_watch && (
                <span className="badge bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Matches your library
                </span>
              )}
              {r.genre_guess && (
                <span className="badge bg-stone-100 text-stone-700">{r.genre_guess}</span>
              )}
              {r.world_guess && (
                <span className="badge bg-stone-100 text-stone-700">{r.world_guess}</span>
              )}
            </div>
            {r.description && (
              <p className="text-xs text-stone-500 line-clamp-3">{r.description}</p>
            )}
            <div className="flex items-center justify-between pt-2 mt-auto border-t border-stone-100">
              <button
                className="btn btn-secondary text-xs"
                onClick={() => onDismiss(r)}
                disabled={busyIds.has(r.google_id)}
                type="button"
              >
                Dismiss
              </button>
              <button
                className="btn btn-primary text-xs"
                onClick={() => onAdd(r)}
                disabled={r.added_to_wishlist || busyIds.has(r.google_id)}
                type="button"
              >
                {r.added_to_wishlist ? "✓ On Wishlist" : "+ Add to Wishlist"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
