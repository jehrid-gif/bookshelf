"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Book } from "@/lib/types";
import { WORLDS, GENRES, MOODS, FORMATS, LENGTH_CATEGORIES } from "@/lib/types";
import {
  computeReadNext,
  computeSuggestionPool,
  type ReadNextEntry,
} from "@/lib/readNext";
import {
  computeTasteMatches,
  computeMovement,
  type MatchMovement,
  type TasteSnapshotEntry,
} from "@/lib/tasteMatch";
import SidePanel from "./SidePanel";
import BookDetail from "./BookDetail";
import BookCover from "./BookCover";

const BookDetailAny = BookDetail as any;

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
  onBookAdded,
}: {
  books: Book[];
  onClose: () => void;
  onBookUpdated: (b: Book) => void;
  onBookDeleted: (id: string) => void;
  onBookAdded?: (b: Book) => void;
}) {
  const [tab, setTab] = useState<"next" | "suggestions" | "dice" | "match">("next");
  const [viewing, setViewing] = useState<Book | null>(null);

  const readNext = useMemo(() => computeReadNext(books), [books]);
  const pool = useMemo(() => computeSuggestionPool(books), [books]);

  // Best Match tab — top 10 unread books ranked against your own rated
  // history. Movement markers compare against a snapshot saved server-side
  // the last time this list was viewed (any device), so "up/down/new" means
  // "since I last actually looked," not just "since page load."
  const tasteResult = useMemo(() => computeTasteMatches(books, 10), [books]);
  const [matchMovement, setMatchMovement] = useState<Map<string, MatchMovement>>(new Map());
  const matchSeqRef = useRef(0);

  useEffect(() => {
    if (tab !== "match" || tasteResult.matches.length === 0) return;
    let cancelled = false;
    const seq = ++matchSeqRef.current;
    (async () => {
      try {
        const res = await fetch("/api/taste-match/snapshot");
        const previous: TasteSnapshotEntry[] = res.ok ? await res.json() : [];
        if (cancelled || seq !== matchSeqRef.current) return;
        setMatchMovement(computeMovement(tasteResult.matches, previous));
        const entries = tasteResult.matches.map((m, i) => ({
          book_id: m.book.trello_id,
          rank: i + 1,
          score: m.score,
        }));
        await fetch("/api/taste-match/snapshot", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        });
      } catch {
        // Best-effort — movement markers just won't show this time, and
        // the underlying ranking (which doesn't depend on the snapshot)
        // is unaffected.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tasteResult]);

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
  const [diceLength, setDiceLength] = useState("");
  const [diceFormat, setDiceFormat] = useState("");
  const [pick, setPick] = useState<Book | null>(null);
  const [diceError, setDiceError] = useState<string | null>(null);

  function roll() {
    setDiceError(null);
    const candidates = pool.filter((entry) => {
      const b = entry.book;
      if (diceWorld && !b.worlds.includes(diceWorld)) return false;
      if (diceGenre && b.genre !== diceGenre) return false;
      if (diceLength && b.length_category !== diceLength) return false;
      if (diceFormat && b.format !== diceFormat) return false;
      return true;
    });
    if (candidates.length === 0) {
      setPick(null);
      setDiceError("No eligible books match those filters right now.");
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
        <button
          type="button"
          onClick={() => setTab("match")}
          className={
            "px-3 py-2 text-sm font-medium border-b-2 -mb-px " +
            (tab === "match"
              ? "border-brass text-brass"
              : "border-transparent text-stone-500 hover:text-ink")
          }
        >
          🎯 Best Match
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
              <li key={entry.series} className="border-b border-stone-100 pb-3 last:border-0 flex gap-3">
                <BookCover
                  book={entry.book}
                  className="w-10 h-14 flex-none"
                  padding="p-1"
                  textSize="text-[6px]"
                  lineClamp="line-clamp-4"
                />
                <div className="min-w-0">
                  <button
                    onClick={() => setViewing(entry.book)}
                    type="button"
                    className="font-medium text-ink hover:text-brass hover:underline text-left block"
                  >
                    {entry.book.title}
                  </button>
                  <p className="text-xs text-stone-500">{entry.reason}</p>
                </div>
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
              <li key={entry.book.trello_id} className="border-b border-stone-100 pb-3 last:border-0 flex gap-3">
                <BookCover
                  book={entry.book}
                  className="w-10 h-14 flex-none"
                  padding="p-1"
                  textSize="text-[6px]"
                  lineClamp="line-clamp-4"
                />
                <div className="min-w-0">
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
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "dice" && (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">
            Narrow by world, genre, length, and/or format, or leave them all open for anything.
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
            <select className="input" value={diceLength} onChange={(e) => setDiceLength(e.target.value)}>
              <option value="">Any length</option>
              {LENGTH_CATEGORIES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select className="input" value={diceFormat} onChange={(e) => setDiceFormat(e.target.value)}>
              <option value="">Any format</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
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
              className="flex gap-3 w-full text-left mt-1 rounded-md bg-parchment/60 border border-stone-200 px-3 py-2 hover:border-stone-300 transition-colors"
            >
              <BookCover
                book={pick}
                className="w-12 h-16 flex-none"
                padding="p-1"
                textSize="text-[7px]"
                lineClamp="line-clamp-4"
              />
              <div className="min-w-0">
                <p className="font-medium text-ink">{pick.title}</p>
                {pick.author && <p className="text-sm text-stone-600">{pick.author}</p>}
                {pick.series && (
                  <p className="text-xs text-stone-500">
                    {pick.series}
                    {pick.series_index ? ` #${pick.series_index}` : ""}
                  </p>
                )}
              </div>
            </button>
          )}
        </div>
      )}

      {tab === "match" && (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">
            Your top 10 unread books, ranked by how well they match what you've actually rated
            highly — genre, author, mood, and world, weighted by how much history backs each one
            up. Recalculated fresh every time you open this, so a run of new ratings can shuffle
            the list.
          </p>

          {tasteResult.insufficientData && (
            <p className="text-sm text-stone-500">{tasteResult.insufficientData}</p>
          )}

          {!tasteResult.insufficientData && tasteResult.matches.length === 0 && (
            <p className="text-sm text-stone-500">
              Nothing in your to-read pile overlaps yet with a genre, author, mood, or world
              you've actually rated.
            </p>
          )}

          <ul className="space-y-3">
            {tasteResult.matches.map((m, i) => {
              const movement = matchMovement.get(m.book.trello_id);
              return (
                <li
                  key={m.book.trello_id}
                  className="border-b border-stone-100 pb-3 last:border-0 flex gap-3"
                >
                  <span className="text-sm font-semibold text-stone-400 w-5 flex-none text-right pt-1">
                    {i + 1}
                  </span>
                  <BookCover
                    book={m.book}
                    className="w-10 h-14 flex-none"
                    padding="p-1"
                    textSize="text-[6px]"
                    lineClamp="line-clamp-4"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setViewing(m.book)}
                        type="button"
                        className="font-medium text-ink hover:text-brass hover:underline text-left"
                      >
                        {m.book.title}
                      </button>
                      {movement?.kind === "new" && (
                        <span className="badge bg-sky-100 text-sky-800 text-[10px]">✨ New</span>
                      )}
                      {movement?.kind === "up" && (
                        <span
                          className="text-emerald-600 text-xs font-semibold"
                          title={`Up ${movement.amount} spot${movement.amount === 1 ? "" : "s"} since you last checked`}
                        >
                          ▲{movement.amount}
                        </span>
                      )}
                      {movement?.kind === "down" && (
                        <span
                          className="text-red-500 text-xs font-semibold"
                          title={`Down ${movement.amount} spot${movement.amount === 1 ? "" : "s"} since you last checked`}
                        >
                          ▼{movement.amount}
                        </span>
                      )}
                    </div>
                    {m.book.author && <p className="text-xs text-stone-500">{m.book.author}</p>}
                    <p className="text-xs text-stone-600 mt-1">{m.why}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {viewing && (
        <BookDetailAny
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
          onReadAgain={
            onBookAdded &&
            ((b) => {
              onBookAdded(b);
              setViewing(null);
            })
          }
        />
      )}
    </SidePanel>
  );
}
