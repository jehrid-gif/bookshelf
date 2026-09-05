"use client";

import { useState } from "react";
import type { Book } from "@/lib/types";
import { WORLDS, GENRES } from "@/lib/types";
import type { ReadNextEntry } from "@/lib/readNext";
import SidePanel from "./SidePanel";
import BookDetail from "./BookDetail";

export default function DiscoverPanel({
  readNext,
  onClose,
  onBookUpdated,
  onBookDeleted,
}: {
  readNext: ReadNextEntry[];
  onClose: () => void;
  onBookUpdated: (b: Book) => void;
  onBookDeleted: (id: string) => void;
}) {
  const [tab, setTab] = useState<"next" | "dice">("next");
  const [viewing, setViewing] = useState<Book | null>(null);

  const [world, setWorld] = useState("");
  const [genre, setGenre] = useState("");
  const [pick, setPick] = useState<Book | null>(null);
  const [loading, setLoading] = useState(false);
  const [rollError, setRollError] = useState<string | null>(null);

  async function roll() {
    setLoading(true);
    setRollError(null);
    setPick(null);
    try {
      const params = new URLSearchParams();
      if (world) params.set("world", world);
      if (genre) params.set("genre", genre);
      const qs = params.toString();
      const res = await fetch(`/api/random${qs ? `?${qs}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No eligible books found");
      setPick(data as Book);
    } catch (err: any) {
      setRollError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SidePanel title="Discover" onClose={onClose}>
      <div className="flex gap-1 mb-4 border-b border-stone-200">
        <button
          type="button"
          onClick={() => setTab("next")}
          className={
            "px-3 py-2 text-sm font-medium border-b-2 -mb-px " +
            (tab === "next"
              ? "border-brass text-brass"
              : "border-transparent text-stone-500 hover:text-ink")
          }
        >
          ➡️ Read Next
        </button>
        <button
          type="button"
          onClick={() => setTab("dice")}
          className={
            "px-3 py-2 text-sm font-medium border-b-2 -mb-px " +
            (tab === "dice"
              ? "border-brass text-brass"
              : "border-transparent text-stone-500 hover:text-ink")
          }
        >
          🎲 Roll the Dice
        </button>
      </div>

      {tab === "next" && (
        <div>
          {readNext.length === 0 && (
            <p className="text-sm text-stone-500">
              No series with a book already finished have a next book ready to go.
            </p>
          )}
          <ul className="space-y-3">
            {readNext.map((entry) => (
              <li key={entry.series} className="border-b border-stone-100 pb-3 last:border-0">
                <button
                  onClick={() => setViewing(entry.book)}
                  type="button"
                  className="font-medium text-ink hover:text-brass hover:underline text-left block"
                >
                  {entry.book.title}
                </button>
                <p className="text-xs text-stone-500">{entry.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "dice" && (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">
            Pick a world and/or genre to narrow it down, or leave both open for anything.
          </p>
          <div className="flex flex-col gap-2">
            <select className="input" value={world} onChange={(e) => setWorld(e.target.value)}>
              <option value="">Any world</option>
              {WORLDS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">Any genre</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={roll} disabled={loading} type="button">
              {loading ? "Rolling…" : "🎲 Roll the Dice"}
            </button>
          </div>
          {rollError && <p className="text-sm text-stone-500">{rollError}</p>}
          {pick && (
            <button
              onClick={() => setViewing(pick)}
              type="button"
              className="block w-full text-left mt-1 rounded-md bg-parchment/60 border border-stone-200 px-3 py-2 hover:border-stone-300 transition-colors"
            >
              <p className="font-medium text-ink">{pick.title}</p>
              {pick.author && <p className="text-sm text-stone-600">{pick.author}</p>}
              {pick.series && (
                <p className="text-xs text-stone-500">
                  {pick.series}
                  {pick.series_index ? ` #${pick.series_index}` : ""}
                </p>
              )}
            </button>
          )}
        </div>
      )}

      {viewing && (
        <BookDetail
          book={viewing}
          onClose={() => setViewing(null)}
          onSaved={(b) => {
            onBookUpdated(b);
            setViewing(b);
            if (pick && pick.trello_id === b.trello_id) setPick(b);
          }}
          onDeleted={(id) => {
            onBookDeleted(id);
            setViewing(null);
            if (pick && pick.trello_id === id) setPick(null);
          }}
        />
      )}
    </SidePanel>
  );
}
