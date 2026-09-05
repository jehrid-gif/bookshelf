"use client";

import { useState } from "react";
import type { Book } from "@/lib/types";

export default function WarhammerButton() {
  const [pick, setPick] = useState<Book | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    setPick(null);
    try {
      const res = await fetch(`/api/warhammer-suggestion`);
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
        <h3 className="font-semibold text-ink">⚔️ Warhammer Roll</h3>
        <button className="btn btn-primary" onClick={go} disabled={loading}>
          {loading ? "Rolling…" : "Suggest a 40k / AoS book"}
        </button>
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
