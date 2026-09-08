import type { Book } from "./types";
import { GENRES } from "./types";
import { computeSeriesStats } from "./seriesStats";

export interface ReadingStreak {
  months: number;
  // The month the current streak started, e.g. "Oct 2024" — for display only.
  sinceLabel: string;
}

// Longest CURRENT run of consecutive months with at least one finish,
// counting backward from this month. The current month gets a grace period:
// if it has no finish yet, that's not treated as breaking the streak (the
// month isn't over), so counting starts from last month instead. A streak
// only actually breaks once a full month passes with zero finishes.
export function computeReadingStreak(books: Book[]): ReadingStreak | null {
  const finished = books.filter((b) => b.status === "finished" && b.date_finished);
  if (finished.length === 0) return null;

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const monthsWithFinish = new Set(finished.map((b) => monthKey(new Date(b.date_finished!))));

  const now = new Date();
  let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!monthsWithFinish.has(monthKey(cursor))) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }

  let count = 0;
  while (monthsWithFinish.has(monthKey(cursor))) {
    count++;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  }
  if (count === 0) return null;

  // cursor now sits one month before the streak began.
  const startMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  const sinceLabel = startMonth.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return { months: count, sinceLabel };
}

export interface PagesMilestone {
  totalPages: number;
  upcoming: number;
  remaining: number;
}

const PAGE_STEP = 25000;

// All-time pages read, with the same "how far to the next round number"
// framing as the books-finished milestone — just measured in pages instead
// of book count. An exact hit on a round number is astronomically unlikely
// (unlike book count, which lands on round numbers constantly), so this
// only ever reports "how far to go," never a "just hit it" moment.
export function computePagesMilestone(books: Book[]): PagesMilestone {
  const totalPages = books
    .filter((b) => b.status === "finished" && typeof b.pages === "number")
    .reduce((sum, b) => sum + (b.pages || 0), 0);
  const upcoming = Math.ceil((totalPages + 1) / PAGE_STEP) * PAGE_STEP;
  const remaining = upcoming - totalPages;
  return { totalPages, upcoming, remaining };
}

export interface Achievement {
  id: string;
  icon: string;
  label: string;
  detail: string;
  unlocked: boolean;
}

const FIVE_STAR_TARGET = 50;
const PAGES_TARGET = 50000;
const SERIES_TARGET = 5;
const FINISHED_TARGET = 100;

// A fixed, hand-picked set rather than an auto-generated list — each one is
// meant to say something real about a reading habit, not just restate a
// number that's already shown elsewhere on the dashboard. Locked badges are
// deliberate: "First Reread" sitting locked is a nudge toward a feature
// that might otherwise go unused, not just an empty state.
export function computeAchievements(books: Book[]): Achievement[] {
  const finished = books.filter((b) => b.status === "finished");
  const finishedCount = finished.length;
  const genresRead = new Set(finished.map((b) => b.genre).filter(Boolean)).size;
  const fiveStars = finished.filter((b) => b.my_rating === 5).length;
  const totalPages = finished.reduce((s, b) => s + (b.pages || 0), 0);
  const hasReread = books.some((b) => b.is_reread);
  const completedSeries = computeSeriesStats(books).filter((s) => s.percent === 100).length;

  return [
    {
      id: "century",
      icon: "💯",
      label: "Century Club",
      detail: `${finishedCount}/${FINISHED_TARGET} books finished`,
      unlocked: finishedCount >= FINISHED_TARGET,
    },
    {
      id: "genres",
      icon: "🧭",
      label: "Genre Explorer",
      detail: `${genresRead}/${GENRES.length} genres read`,
      unlocked: genresRead >= GENRES.length,
    },
    {
      id: "series",
      icon: "🏰",
      label: "Series Completionist",
      detail: `${completedSeries}/${SERIES_TARGET} series completed`,
      unlocked: completedSeries >= SERIES_TARGET,
    },
    {
      id: "five-stars",
      icon: "🌟",
      label: `${FIVE_STAR_TARGET} Five-Star Reads`,
      detail: `${fiveStars}/${FIVE_STAR_TARGET} five-star ratings`,
      unlocked: fiveStars >= FIVE_STAR_TARGET,
    },
    {
      id: "pages",
      icon: "📖",
      label: "50K Pages Club",
      detail: `${totalPages.toLocaleString()}/${PAGES_TARGET.toLocaleString()} pages`,
      unlocked: totalPages >= PAGES_TARGET,
    },
    {
      id: "reread",
      icon: "🔁",
      label: "First Reread",
      detail: hasReread ? "You've revisited an old favorite" : "Try Read Again on a book you loved",
      unlocked: hasReread,
    },
  ];
}
