"use client";

import { useEffect, useMemo, useState } from "react";
import type { Book } from "@/lib/types";
import { WORLDS, GENRES, MOODS } from "@/lib/types";
import {
  computeReadNext,
  computeSuggestionPool,
  type ReadNextEntry,
} from "@/lib/readNext";
import SidePanel from "./SidePanel";
import BookDetail from "./BookDetail";

const SUGGESTION_COUNT = 3;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function DiscoverPanel({
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
  const [tab, setTab] = useState<"next" | "suggestions" | "dice">("next");
  const [viewing, setViewing] = useState<Book | null>(null);

  const readNext = useMemo(() => computeReadNext(books), [books]);
  const pool = useMemo(() => computeSuggestionPool(books), [books]);

  // Suggestions tab — a small curated, filterable, reshuffleable sample.
  const [suggWorld, setSuggWorld] = useState("");
  const [suggGenre, setSuggGenre] = useState("");
  const [suggMood, setSuggMood] = useState("");
  const [suggShown, setSuggShown] = useState<ReadNextEntry[]>([]);

  const suggFiltered = useMemo(() => {
    return pool.filter((entry) => {
      const b = entry.book;
      if (suggWorld && !b.worlds.includes(suggWorld)) return false;
      if (suggGenre && b.genre !== suggGenre) return false;
      if (suggMood && !b.moods.includes(suggMood)) return false;
      return true;
    });
  }, [pool, suggWorld, suggGenre, suggMood]);

  function reshuffle(source: ReadNextEntry[] = suggFiltered) {
    setSuggShown(shuffle(source).slice(0, SUGGESTION_COUNT));
  }

  // Redraw the curated sample whenever the filters (or the underlying pool)
  // change, so switching World/Genre/Mood updates the picks without needing
  // an extra click — Reshuffle is for "show me something else" within the
  // same filters.
  useEffect(() => {
    reshuffle(suggFiltered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggFiltered]);

  // Find Your Next Read tab — one random pick from the same eligible pool.
  const [diceWorld, setDiceWorld] = useState("");
  const [diceGenre, setDiceGenre] = useState("");
  const [pick, setPick] = useState<Book | null>(null);
  const [diceError, setDiceError] = useState<string | null>(null);

  function roll() {
    setDiceError(null);
    const candidates = pool.filter((entry) => {
      const b = entry.book;
      if (diceWorld && !b.worlds.includes(diceWorld)) return false;
      if (diceGenre && b.genre !== diceGenre) return false;
      return true;
    });
    if (candidates.length === 0) {
      setPick(null);
      setDiceError("No eligible books match that world/genre right now.");
      return;
    }
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    setPick(choice.book);
  }

  return (
    <SidePanel title="Discover" onClose={onClose}>
      <div className="flex gap-1 mb-4 border-b border-stone-200 flex-wrap">
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
          📋 Read Next
        </button>
        <button
          type="button"
          onClick={() => setTab("suggestions")}
          className={
            "px-3 py-2 text-sm font-medium border-b-2 -mb-px " +
            (tab === "suggestions"
              ? "border-brass text-brass"
              : "border-transparent text-stone-500 hover:text-ink")
          }
        >
          ✨ Suggestions
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
          🎲 Find Your Next Read
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

      {tab === "suggestions" && (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">
            A handful of catered picks — narrow by world, genre, or mood, or just reshuffle.
          </p>
          <div className="grid grid-cols-1 gap-2">
            <select
              className="input"
              value={suggWorld}
              onChange={(e) => {
                setSuggWorld(e.target.value);
              }}
            >
              <option value="">Any world</option>
              {WORLDS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={suggGenre}
              onChange={(e) => {
                setSuggGenre(e.target.value);
              }}
            >
              <option value="">Any genre</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={suggMood}
              onChange={(e) => {
                setSuggMood(e.target.value);
              }}
            >
              <option value="">Any mood</option>
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => reshuffle(suggFiltered)}
            >
              🔀 Reshuffle
            </button>
          </div>

          {suggFiltered.length === 0 && (
            <p className="text-sm text-stone-500">Nothing eligible matches those filters yet.</p>
          )}
          <ul className="space-y-3">
            {suggShown.map((entry) => (
              <li key={entry.book.trello_id} className="border-b border-stone-100 pb-3 last:border-0">
                <button
                  onClick={() => setViewing(entry.book)}
                  type="button"
                  className="font-medium text-ink hover:text-brass hover:underline text-left block"
                >
                  {entry.book.title}
                </button>
                {entry.book.author && (
                  <p className="text-xs text-stone-500">{entry.book.author}</p>
                )}
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
            <select className="input" value={diceWorld} onChange={(e) => setDiceWorld(e.target.value)}>
              <option value="">Any world</option>
              {WORLDS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select className="input" value={diceGenre} onChange={(e) => setDiceGenre(e.target.value)}>
              <option value="">Any genre</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={roll} type="button">
              🎲 Roll
            </button>
          </div>
          {diceError && <p className="text-sm text-stone-500">{diceError}</p>}
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
