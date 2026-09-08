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
  const [tab, setTab] = useState<"next" | "roll" | "match">("next");
  const [viewing, setViewing] = useState<Book | null>(null);

  const readNext = useMemo(() => computeReadNext(books), [books]);
  const pool = useMemo(() => computeSuggestionPool(books), [books]);

  // Roll the Dice tab — one shared filter set over the same eligible pool,
  // with two ways to draw from it: a reshuffleable sample of 3, or a single
  // committed pick. These used to be two separate tabs (Suggestions / Find
  // Your Next Read) that differed only in filters offered and how many
  // books came back — merged into one since there wasn't a real reason to
  // pick between them.
  const [rollWorld, setRollWorld] = useState("");
  const [rollGenre, setRollGenre] = useState("");
  const [rollMood, setRollMood] = useState("");
  const [rollLength, setRollLength] = useState("");
  const [rollFormat, setRollFormat] = useState("");
  const [rollMode, setRollMode] = useState<"three" | "one">("three");
  const [rollShown, setRollShown] = useState<ReadNextEntry[]>([]);
  const [rollPick, setRollPick] = useState<Book | null>(null);
  const [rollError, setRollError] = useState<string | null>(null);

  const rollFiltered = useMemo(() => {
    return pool.filter((entry) => {
      const b = entry.book;
      if (rollWorld && !b.worlds.includes(rollWorld)) return false;
      if (rollGenre && b.genre !== rollGenre) return false;
      if (rollMood && !b.moods.includes(rollMood)) return false;
      if (rollLength && b.length_category !== rollLength) return false;
      if (rollFormat && b.format !== rollFormat) return false;
      return true;
    });
  }, [pool, rollWorld, rollGenre, rollMood, rollLength, rollFormat]);

  function showThree(source: ReadNextEntry[]) {
    setRollMode("three");
    if (source.length === 0) {
      setRollShown([]);
      setRollError("Nothing eligible matches those filters yet.");
      return;
    }
    setRollError(null);
    setRollShown(shuffle(source).slice(0, SUGGESTION_COUNT));
  }

  function rollOne() {
    setRollMode("one");
    if (rollFiltered.length === 0) {
      setRollPick(null);
      setRollError("No eligible books match those filters right now.");
      return;
    }
    setRollError(null);
    const choice = rollFiltered[Math.floor(Math.random() * rollFiltered.length)];
    setRollPick(choice.book);
  }

  // Redraw the "3 picks" sample whenever the filters (or pool) change and
  // we're in that mode — Reshuffle is for "show me something else" within
  // the same filters. A committed single Roll deliberately does NOT
  // auto-reroll when a filter changes; that stays put until you click Roll
  // again, same as before the tabs merged.
  useEffect(() => {
    if (rollMode === "three") showThree(rollFiltered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollFiltered]);

  // Best Match tab — top 10 unread books ranked against your own rated
  // history. Movement markers compare against a snapshot saved server-side
  // the last time this list was viewed (any device), so "up/down/new" means
  // "since I last actually looked," not just "since page load."
  const tasteResult = useMemo(() => computeTasteMatches(books, 10), [books]);
  const [matchMovement, setMatchMovement] = useState<Map<string, MatchMovement>>(new Map());
  const [expandedWhy, setExpandedWhy] = useState<Set<string>>(new Set());
  const matchSeqRef = useRef(0);

  function toggleWhy(id: string) {
    setExpandedWhy((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  const TAB_LABEL: Record<typeof tab, string> = {
    next: "📋 Read Next",
    roll: "🎲 Roll the Dice",
    match: "🎯 Best Match",
  };

  function TabButton({ id }: { id: "next" | "roll" | "match" }) {
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        className={
          "px-3 py-2 text-sm font-medium border-b-2 -mb-px " +
          (tab === id
            ? "border-brass text-brass"
            : "border-transparent text-stone-500 hover:text-ink")
        }
      >
        {TAB_LABEL[id]}
      </button>
    );
  }

  return (
    <SidePanel title="Discover" onClose={onClose}>
      <div className="flex gap-1 mb-4 border-b border-stone-200 flex-wrap">
        <TabButton id="next" />
        <TabButton id="roll" />
        <TabButton id="match" />
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

      {tab === "roll" && (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">
            Narrow by world, genre, mood, length, and/or format, or leave them all open for
            anything — then reshuffle a small sample or roll for one committed pick.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={rollWorld} onChange={(e) => setRollWorld(e.target.value)}>
              <option value="">Any world</option>
              {WORLDS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select className="input" value={rollGenre} onChange={(e) => setRollGenre(e.target.value)}>
              <option value="">Any genre</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select className="input" value={rollMood} onChange={(e) => setRollMood(e.target.value)}>
              <option value="">Any mood</option>
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select className="input" value={rollLength} onChange={(e) => setRollLength(e.target.value)}>
              <option value="">Any length</option>
              {LENGTH_CATEGORIES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              className="input col-span-2"
              value={rollFormat}
              onChange={(e) => setRollFormat(e.target.value)}
            >
              <option value="">Any format</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary flex-1"
              type="button"
              onClick={() => showThree(rollFiltered)}
            >
              🔀 Show Me 3
            </button>
            <button className="btn btn-primary flex-1" type="button" onClick={rollOne}>
              🎲 Roll One
            </button>
          </div>

          {rollError && <p className="text-sm text-stone-500">{rollError}</p>}

          {!rollError && rollMode === "three" && (
            <ul className="space-y-3">
              {rollShown.map((entry) => (
                <li
                  key={entry.book.trello_id}
                  className="border-b border-stone-100 pb-3 last:border-0 flex gap-3"
                >
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
          )}

          {!rollError && rollMode === "one" && rollPick && (
            <button
              onClick={() => setViewing(rollPick)}
              type="button"
              className="flex gap-3 w-full text-left rounded-md bg-parchment/60 border border-stone-200 px-3 py-2 hover:border-stone-300 transition-colors"
            >
              <BookCover
                book={rollPick}
                className="w-12 h-16 flex-none"
                padding="p-1"
                textSize="text-[7px]"
                lineClamp="line-clamp-4"
              />
              <div className="min-w-0">
                <p className="font-medium text-ink">{rollPick.title}</p>
                {rollPick.author && <p className="text-sm text-stone-600">{rollPick.author}</p>}
                {rollPick.series && (
                  <p className="text-xs text-stone-500">
                    {rollPick.series}
                    {rollPick.series_index ? ` #${rollPick.series_index}` : ""}
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
            highly. Recalculated fresh every time you open this, so a run of new ratings can
            shuffle the list.
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
              const expanded = expandedWhy.has(m.book.trello_id);
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
                    <p className="text-xs text-stone-600 mt-1">
                      {expanded ? m.why : m.whyShort}{" "}
                      {m.why !== m.whyShort && (
                        <button
                          type="button"
                          onClick={() => toggleWhy(m.book.trello_id)}
                          className="text-stone-400 hover:text-brass underline decoration-dotted underline-offset-2"
                        >
                          {expanded ? "less" : "why?"}
                        </button>
                      )}
                    </p>
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
            if (rollPick && rollPick.trello_id === b.trello_id) setRollPick(b);
          }}
          onDeleted={(id) => {
            onBookDeleted(id);
            setViewing(null);
            if (rollPick && rollPick.trello_id === id) setRollPick(null);
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
