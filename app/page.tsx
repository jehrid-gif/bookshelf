"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Book, ReadingGoal } from "@/lib/types";
import { isIncomplete, GENRES, WORLDS, FORMATS } from "@/lib/types";
import ExportButton from "@/components/ExportButton";
import KanbanBoard from "@/components/KanbanBoard";
import SearchFilterBar from "@/components/SearchFilterBar";
import ReadingPanel from "@/components/ReadingPanel";
import DiscoverPanel from "@/components/DiscoverPanel";
import MilestonesPanel from "@/components/MilestonesPanel";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import BookDetail from "@/components/BookDetail";
import BookForm from "@/components/BookForm";
import Modal from "@/components/Modal";
import Skeleton from "@/components/Skeleton";
import { normalizeIsbn } from "@/lib/isbn";
const BookDetailAny = BookDetail as any;
const DiscoverPanelAny = DiscoverPanel as any;

export default function DashboardPage() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [readingOpen, setReadingOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(false);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanSeed, setScanSeed] = useState<Partial<Book> | null>(null);
  const [scanLookingUp, setScanLookingUp] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewingBook, setViewingBook] = useState<Book | null>(null);

  const [boardSearch, setBoardSearch] = useState("");
  const [boardFiltersOpen, setBoardFiltersOpen] = useState(false);
  const [boardGenre, setBoardGenre] = useState("");
  const [boardWorld, setBoardWorld] = useState("");
  const [boardFormat, setBoardFormat] = useState("");
  const [boardSpecialOnly, setBoardSpecialOnly] = useState(false);

  const [goal, setGoal] = useState<ReadingGoal | null | undefined>(undefined);
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    fetch("/api/books")
      .then((res) => res.json())
      .then((data) => setBooks(data as Book[]))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    fetch("/api/reading-goal")
      .then((res) => res.json())
      .then((data) => setGoal(data))
      .catch(() => setGoal(null));
  }, []);

  async function handleSetGoal() {
    const currentYear = new Date().getFullYear();
    const input = prompt(
      `How many books do you want to read in ${currentYear}?`,
      goal?.goal ? String(goal.goal) : ""
    );
    if (input === null) return;
    const parsed = Number(input);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      alert("Enter a whole number greater than 0.");
      return;
    }
    setSavingGoal(true);
    try {
      const res = await fetch("/api/reading-goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: currentYear, goal: parsed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save goal");
      setGoal(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingGoal(false);
    }
  }

  function applySavedBook(updated: Book) {
    setBooks((prev) =>
      prev ? prev.map((b) => (b.trello_id === updated.trello_id ? updated : b)) : prev
    );
  }

  function handleDeleted(id: string) {
    setBooks((prev) => (prev ? prev.filter((b) => b.trello_id !== id) : prev));
    setViewingBook(null);
  }

  function closeAdding() {
    setAdding(false);
    setScanSeed(null);
    setScanNotice(null);
  }

  function handleAdded(created: Book) {
    setBooks((prev) => (prev ? [created, ...prev] : [created]));
    closeAdding();
  }

  function handleReadAgain(created: Book) {
    setBooks((prev) => (prev ? [created, ...prev] : [created]));
    setViewingBook(null);
  }

  // Barcode scan result: an ISBN already on a book in the library opens that
  // book's card directly; otherwise it's looked up on Google Books to
  // pre-fill a new Add Book form.
  async function handleIsbnDetected(rawIsbn: string) {
    setScanOpen(false);
    const isbn = normalizeIsbn(rawIsbn);

    const match = (books || []).find((b) => b.isbn && normalizeIsbn(b.isbn) === isbn);
    if (match) {
      setViewingBook(match);
      return;
    }

    setScanLookingUp(true);
    setScanNotice(null);
    try {
      const res = await fetch(`/api/books/lookup-isbn?isbn=${encodeURIComponent(isbn)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      if (data.found) {
        setScanSeed(data.seed);
      } else {
        setScanSeed({ isbn });
        setScanNotice(
          "No match found on Google Books for that ISBN — fill in the rest by hand."
        );
      }
      setAdding(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanLookingUp(false);
    }
  }

  const [reordering, setReordering] = useState(false);

  // One-press reorder: priority books lead the To Read column, everything
  // else keeps its existing relative order behind them.
  async function bringPriorityToTop() {
    if (!books) return;
    const toReadSorted = books
      .filter((b) => b.status === "to_read")
      .sort((a, b) => a.board_pos - b.board_pos);
    const ordered = [
      ...toReadSorted.filter((b) => b.priority),
      ...toReadSorted.filter((b) => !b.priority),
    ];
    const changed = ordered
      .map((b, i) => ({ b, pos: i }))
      .filter(({ b, pos }) => b.board_pos !== pos);
    if (changed.length === 0) return;

    setReordering(true);
    // Optimistic update first so the board re-sorts immediately.
    for (const { b, pos } of changed) applySavedBook({ ...b, board_pos: pos });
    try {
      // Each PATCH touches a different book's board_pos independently, so
      // there's no write conflict between them — firing them together
      // instead of one-at-a-time turns N round-trips into one.
      await Promise.all(
        changed.map(({ b, pos }) =>
          fetch(`/api/books/${b.trello_id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ board_pos: pos }),
          })
        )
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReordering(false);
    }
  }

  const derived = useMemo(() => {
    const list = books || [];
    // Reread copies represent the same physical/owned book being read again,
    // not a new acquisition — they're excluded from inventory-style counts
    // (Total Books, Owned, Completion by Format) but still show up under
    // Reading/Finished since that's a real reading activity.
    const nonRereadList = list.filter((b) => !(b as any).is_reread);
    const toRead = list.filter((b) => b.status === "to_read");
    const reading = list.filter((b) => b.status === "reading");
    const incomplete = list.filter(isIncomplete);
    const uncheckedForCovers = list.filter((b) => !b.enrichment_status).length;
    const finished = list.filter((b) => b.status === "finished");
    const wishlist = list.filter((b) => b.status === "wishlist");
    // Wishlist entries aren't owned yet, so they're excluded from every
    // inventory-style count below the same way rereads are — Total Books,
    // Owned, and every row of Completion by Format all share this one base
    // population instead of each re-deriving it (and disagreeing) separately.
    const trackedList = nonRereadList.filter((b) => b.status !== "wishlist");
    const owned = trackedList.filter((b) => b.owned);

    const currentYear = new Date().getFullYear();
    const finishedThisYear = finished.filter(
      (b) => b.date_finished && new Date(b.date_finished).getFullYear() === currentYear
    );
    const pagesThisYear = finishedThisYear.reduce((sum, b) => sum + (b.pages || 0), 0);
    const rated = finished.filter((b) => typeof b.my_rating === "number");
    const avgRating = rated.length
      ? rated.reduce((sum, b) => sum + (b.my_rating || 0), 0) / rated.length
      : null;

    // On This Day — anything finished on today's month/day in an earlier
    // year. A once-a-year coincidence per book, so this is usually empty,
    // which is fine — it only needs to be a nice surprise when it isn't.
    const today = new Date();
    const onThisDay = finished
      .filter((b) => {
        if (!b.date_finished) return false;
        const d = new Date(b.date_finished);
        return (
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate() &&
          d.getFullYear() !== today.getFullYear()
        );
      })
      .sort(
        (a, b) => new Date(b.date_finished!).getFullYear() - new Date(a.date_finished!).getFullYear()
      );

    // Milestones — round-number totals across every finished read (rereads
    // included, since a reread is just as real a finish). Fixed step list up
    // to 1000 books, then every 250 beyond that.
    const MILESTONES = [
      10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000,
    ];
    const totalFinishedAllTime = finished.length;
    const justHitMilestone = MILESTONES.includes(totalFinishedAllTime)
      ? totalFinishedAllTime
      : totalFinishedAllTime > 1000 && totalFinishedAllTime % 250 === 0
      ? totalFinishedAllTime
      : null;
    const upcomingMilestone =
      MILESTONES.find((m) => m > totalFinishedAllTime) ??
      Math.ceil((totalFinishedAllTime + 1) / 250) * 250;
    const milestoneRemaining = upcomingMilestone - totalFinishedAllTime;

    // Reading personality — a light, deterministic read on your overall
    // habits. Checked in order of "most specific/interesting signal first"
    // so a reader who fits several labels gets the most distinctive one.
    function computePersonality(): { title: string; blurb: string } | null {
      if (finished.length < 5) return null;
      const rereadCount = list.filter((b) => b.is_reread).length;
      const genreSet = new Set(finished.map((b) => b.genre).filter(Boolean));
      const seriesCounts = new Map<string, number>();
      for (const b of finished) {
        const s = (b.series || "").trim();
        if (!s) continue;
        seriesCounts.set(s, (seriesCounts.get(s) || 0) + 1);
      }
      const maxSeriesCount = seriesCounts.size ? Math.max(...seriesCounts.values()) : 0;
      const timed = finished.filter((b) => b.date_started && b.date_finished);
      const avgDays = timed.length
        ? timed.reduce(
            (sum, b) =>
              sum +
              (new Date(b.date_finished!).getTime() - new Date(b.date_started!).getTime()) /
                86400000,
            0
          ) / timed.length
        : null;
      const standaloneCount = finished.filter((b) => !b.series || !b.series.trim()).length;

      if (rereadCount >= 5) {
        return {
          title: "The Comfort Rereader",
          blurb: `You've read something again ${rereadCount} times — old favorites are worth revisiting.`,
        };
      }
      if (maxSeriesCount >= 5) {
        return {
          title: "The Series Devotee",
          blurb: `You've stuck with one series for ${maxSeriesCount} books — once you're in, you're in.`,
        };
      }
      if (genreSet.size >= 5) {
        return {
          title: "The Genre Explorer",
          blurb: `You've finished books across ${genreSet.size} different genres — nothing pins you down.`,
        };
      }
      if (avgDays !== null && avgDays <= 4) {
        return {
          title: "The Speed Reader",
          blurb: `You finish a book in about ${Math.round(avgDays)} day${Math.round(avgDays) === 1 ? "" : "s"} on average.`,
        };
      }
      if (avgDays !== null && avgDays >= 30) {
        return {
          title: "The Slow Burn Reader",
          blurb: `You like to savor a book — about ${Math.round(avgDays)} days per read on average.`,
        };
      }
      if (finished.length && standaloneCount / finished.length >= 0.7) {
        return {
          title: "The Standalone Fan",
          blurb: "You mostly pick books that don't ask for a sequel commitment.",
        };
      }
      return {
        title: "The Steady Reader",
        blurb: "A well-rounded reading habit — no single label fits quite right, and that's its own kind of consistent.",
      };
    }
    const personality = computePersonality();

    const stats = {
      total: trackedList.length,
      finished: finished.length,
      reading: reading.length,
      toRead: toRead.length,
      wishlist: wishlist.length,
    };

    function pct(sub: Book[]) {
      const done = sub.filter((b) => b.status === "finished").length;
      return { done, total: sub.length, percent: sub.length ? Math.round((done / sub.length) * 100) : 0 };
    }
    const physical = trackedList.filter(
      (b) => b.format === "physical" || b.format === "physical+ebook"
    );
    const digital = trackedList.filter(
      (b) => b.format === "ebook" || b.format === "physical+ebook"
    );
    const formatBreakdown = [
      { label: "Physical", ...pct(physical) },
      { label: "Digital", ...pct(digital) },
      { label: "All Books", ...pct(trackedList) },
    ];

    return {
      reading,
      incomplete,
      uncheckedForCovers,
      currentYear,
      finishedThisYear,
      pagesThisYear,
      avgRating,
      stats,
      owned,
      formatBreakdown,
      onThisDay,
      justHitMilestone,
      upcomingMilestone,
      milestoneRemaining,
      personality,
    };
  }, [books]);

  const boardFilter = (b: Book) => {
    if (boardSearch) {
      const q = boardSearch.trim().toLowerCase();
      if (!b.title.toLowerCase().includes(q) && !(b.author || "").toLowerCase().includes(q)) {
        return false;
      }
    }
    if (boardGenre && b.genre !== boardGenre) return false;
    if (boardWorld && !b.worlds.includes(boardWorld)) return false;
    if (boardFormat && b.format !== boardFormat) return false;
    if (boardSpecialOnly && !b.special_edition) return false;
    return true;
  };

  if (error) {
    return <div className="rounded-md bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>;
  }

  if (!books) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading your shelf">
        <div className="flex items-center gap-3 flex-wrap">
          <Skeleton className="h-7 w-32" />
        </div>

        <div className="rounded-lg border border-stone-200 shadow-sm bg-surface overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="text-center px-3 py-4 border-r border-b sm:border-b-0 border-stone-200 last:border-r-0"
              >
                <Skeleton className="h-6 w-10 mx-auto mb-2" />
                <Skeleton className="h-3 w-14 mx-auto" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-stone-200">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-3 py-3 text-center">
                <Skeleton className="h-5 w-12 mx-auto mb-2" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-3 overflow-hidden pb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 min-w-[16rem] bg-stone-100 rounded-xl border border-stone-200 p-3 space-y-2"
              >
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-ink shrink-0">Dashboard</h1>

        {derived.incomplete.length > 0 && (
          <Link
            href="/library?incomplete=1"
            className="flex-1 min-w-[160px] order-3 sm:order-none rounded-md border-2 border-amber-500 bg-amber-200 hover:bg-amber-300 transition-colors px-3 py-1.5"
          >
            <p className="text-amber-950 font-bold text-sm text-center sm:text-left">
              <span className="hidden sm:inline">
                ⚠️ {derived.incomplete.length} book{derived.incomplete.length === 1 ? "" : "s"} missing
                data — click to fill in the next one
              </span>
              <span className="sm:hidden">
                ⚠️ {derived.incomplete.length} missing data
              </span>
            </p>
          </Link>
        )}

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            className="btn btn-primary"
            onClick={() => setScanOpen(true)}
            disabled={scanLookingUp}
            type="button"
          >
            {scanLookingUp ? "Looking up…" : "📷 Scan"}
          </button>
          <button className="btn btn-primary" onClick={() => setMilestonesOpen(true)} type="button">
            🏆 Milestones
          </button>
          <button className="btn btn-primary" onClick={() => setDiscoverOpen(true)} type="button">
            🧭 Discover
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-stone-200 shadow-sm bg-surface overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-5">
          <StatTile label="Total Books" value={derived.stats.total} onClick={() => router.push("/library")} />
          <StatTile
            label="Finished"
            value={derived.stats.finished}
            onClick={() => router.push("/library?status=finished")}
          />
          <StatTile label="Reading" value={derived.stats.reading} onClick={() => setReadingOpen(true)} />
          <StatTile
            label="To Read"
            value={derived.stats.toRead}
            onClick={() => router.push("/library?status=to_read")}
          />
          <StatTile
            label="Wishlist"
            value={derived.stats.wishlist}
            onClick={() => router.push("/library?status=wishlist")}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-stone-200">
          <LedgerCell value={derived.owned.length} label="Owned" />
          <LedgerCell
            value={derived.finishedThisYear.length}
            label={`Finished ${derived.currentYear}`}
            href={`/year-in-review?year=${derived.currentYear}`}
            extra={
              goal ? (
                <div
                  className="h-1 rounded-full bg-stone-100 overflow-hidden mt-1.5"
                  title={`${Math.min(
                    100,
                    Math.round((derived.finishedThisYear.length / goal.goal) * 100)
                  )}% of your ${derived.currentYear} reading goal (${goal.goal} books) — see Milestones for details`}
                >
                  <div
                    className="h-full bg-brass rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((derived.finishedThisYear.length / goal.goal) * 100)
                      )}%`,
                    }}
                  />
                </div>
              ) : undefined
            }
          />
          <LedgerCell value={derived.pagesThisYear.toLocaleString()} label={`Pages ${derived.currentYear}`} />
          <LedgerCell
            value={derived.avgRating ? `${derived.avgRating.toFixed(1)}★` : "—"}
            label="Avg Rating"
          />
        </div>

        <div className="border-t border-stone-200 p-4">
          <h2 className="font-semibold text-ink mb-3">📚 Completion by Format</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {derived.formatBreakdown.map((f) => (
              <div key={f.label}>
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-sm font-medium text-ink">{f.label}</p>
                  <p className="text-xs text-stone-500">
                    {f.percent}% · {f.done}/{f.total}
                  </p>
                </div>
                <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full bg-brass rounded-full" style={{ width: `${f.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {derived.uncheckedForCovers > 0 && (
        <Link
          href="/library"
          className="block card border-sky-200 bg-sky-50 hover:bg-sky-100 transition-colors"
        >
          <p className="text-sky-900 font-medium">
            🔍 {derived.uncheckedForCovers} book{derived.uncheckedForCovers === 1 ? "" : "s"} haven't
            been checked against Google Books for cover art, descriptions, and ISBNs yet — click to
            run it
          </p>
        </Link>
      )}

      {derived.onThisDay.length > 0 && (
        <div className="card border-violet-200 bg-violet-50">
          <p className="text-violet-900 text-sm">
            📖 On this day, you finished{" "}
            {derived.onThisDay.map((b, i) => (
              <span key={b.trello_id}>
                {i > 0 && (i === derived.onThisDay.length - 1 ? " and " : ", ")}
                <button
                  type="button"
                  className="font-medium underline hover:no-underline"
                  onClick={() => setViewingBook(b)}
                >
                  {b.title}
                </button>{" "}
                ({new Date(b.date_finished!).getFullYear()})
              </span>
            ))}
            .
          </p>
        </div>
      )}

      {derived.justHitMilestone && (
        <div className="card border-amber-300 bg-amber-50 text-center">
          <p className="text-amber-900 font-semibold">
            🎉 {derived.justHitMilestone}th book finished — milestone reached!
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-ink font-display">📋 Board</h2>
        <SearchFilterBar
          search={boardSearch}
          onSearchChange={setBoardSearch}
          open={boardFiltersOpen}
          onOpenChange={setBoardFiltersOpen}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select className="input" value={boardGenre} onChange={(e) => setBoardGenre(e.target.value)}>
              <option value="">All genres</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select className="input" value={boardWorld} onChange={(e) => setBoardWorld(e.target.value)}>
              <option value="">All worlds</option>
              {WORLDS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={boardFormat}
              onChange={(e) => setBoardFormat(e.target.value)}
            >
              <option value="">All formats</option>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm px-1">
              <input
                type="checkbox"
                checked={boardSpecialOnly}
                onChange={(e) => setBoardSpecialOnly(e.target.checked)}
              />
              ✨ Special editions
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={bringPriorityToTop}
              disabled={reordering}
            >
              {reordering ? "Reordering…" : "🔥 Priority to Top"}
            </button>
          </div>
        </SearchFilterBar>
        <KanbanBoard
          books={books}
          onBookUpdated={applySavedBook}
          onBookDeleted={handleDeleted}
          filter={boardFilter}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/year-in-review" className="btn btn-primary">
          📅 Year in Review
        </Link>
        <Link href="/releases" className="btn btn-primary">
          🔮 Upcoming Releases
        </Link>
        <ExportButton />
      </div>

      {readingOpen && (
        <ReadingPanel
          books={derived.reading}
          onClose={() => setReadingOpen(false)}
          onBookUpdated={applySavedBook}
          onBookDeleted={handleDeleted}
        />
      )}

      {discoverOpen && (
        <DiscoverPanelAny
          books={books}
          onClose={() => setDiscoverOpen(false)}
          onBookUpdated={applySavedBook}
          onBookDeleted={handleDeleted}
          onBookAdded={handleReadAgain}
        />
      )}

      {scanOpen && (
        <BarcodeScannerModal onDetected={handleIsbnDetected} onClose={() => setScanOpen(false)} />
      )}

      {adding && (
        <Modal title="Add Book" onClose={closeAdding}>
          <div className="space-y-3">
            {scanNotice && (
              <p className="text-sm rounded-md bg-amber-50 text-amber-900 px-3 py-2">
                {scanNotice}
              </p>
            )}
            <BookForm book={null} seed={scanSeed} onSaved={handleAdded} onCancel={closeAdding} />
          </div>
        </Modal>
      )}

      {viewingBook && (
        <BookDetailAny
          book={viewingBook}
          onClose={() => setViewingBook(null)}
          onSaved={(b) => {
            applySavedBook(b);
            setViewingBook(b);
          }}
          onDeleted={handleDeleted}
          onReadAgain={handleReadAgain}
        />
      )}

      {milestonesOpen && (
        <MilestonesPanel
          books={books}
          justHitMilestone={derived.justHitMilestone}
          upcomingMilestone={derived.upcomingMilestone}
          milestoneRemaining={derived.milestoneRemaining}
          personality={derived.personality}
          goal={goal}
          savingGoal={savingGoal}
          onSetGoal={handleSetGoal}
          currentYear={derived.currentYear}
          finishedThisYear={derived.finishedThisYear.length}
          onClose={() => setMilestonesOpen(false)}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-center hover:bg-parchment/60 transition-colors w-full px-3 py-4 border-r border-b sm:border-b-0 border-stone-200 last:border-r-0"
    >
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
    </button>
  );
}

function LedgerCell({
  value,
  label,
  href,
  extra,
}: {
  value: number | string;
  label: string;
  href?: string;
  // Optional small addition rendered below the label — used only by the
  // Finished-this-year cell for its reading-goal thermometer, so every
  // other ledger cell keeps its exact existing appearance by simply not
  // passing this.
  extra?: React.ReactNode;
}) {
  const inner = (
    <>
      <p className="text-lg font-semibold text-ink font-mono tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-stone-500 mt-0.5">{label}</p>
      {extra}
    </>
  );
  const className =
    "px-4 py-3 border-r border-b sm:border-b-0 border-stone-200 last:border-r-0 block";
  if (href) {
    return (
      <Link href={href} className={`${className} hover:bg-parchment/60 transition-colors`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
