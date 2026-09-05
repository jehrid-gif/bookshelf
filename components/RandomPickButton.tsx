"use client";

import { useState } from "react";
import type { Book } from "@/lib/types";
import { WORLDS } from "@/lib/types";

export default function RandomPickButton() {
  const [pick, setPick] = useState<Book | null>(null);
  const [world, setWorld] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    setPick(null);
    try {
      const qs = world ? `?world=${encodeURIComponent(world)}` : "";
      const res = await fetch(`/api/random${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No eligible books found");
      setPick(data as Book);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-ink">🎲 Random Pick</h3>
        <div className="flex items-center gap-2">
          <select
            className="input !w-auto text-xs"
            value={world}
            onChange={(e) => setWorld(e.target.value)}
          >
            <option value="">Any world</option>
            {WORLDS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={go} disabled={loading}>
            {loading ? "Picking…" : "Pick a book"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-stone-500 mt-2">{error}</p>}
      {pick && (
        <div className="mt-3 rounded-md bg-parchment/60 border border-stone-200 px-3 py-2">
          <p className="font-medium text-ink">{pick.title}</p>
          {pick.author && <p className="text-sm text-stone-600">{pick.author}</p>}
          {pick.series && (
            <p className="text-xs text-stone-500">
              {pick.series}
              {pick.series_index ? ` #${pick.series_index}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
