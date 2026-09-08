"use client";

import { useMemo } from "react";
import type { Book, ReadingGoal } from "@/lib/types";
import { computeReadingStreak, computePagesMilestone, computeAchievements } from "@/lib/milestones";
import SidePanel from "./SidePanel";

// Milestones, Reading Goal, Streak, Pages, Achievements, and Reading
// Personality — pulled out of the dashboard flow into a panel you open on
// demand — a "how am I doing overall" check-in rather than something that
// needs to sit on the page at all times. The Reading Goal card used to live
// directly on the dashboard; it moved here so the dashboard's own info
// panels stay uncluttered (a compact thermometer version stays on the
// Finished-this-year tile instead).
export default function MilestonesPanel({
  books,
  justHitMilestone,
  upcomingMilestone,
  milestoneRemaining,
  personality,
  goal,
  savingGoal,
  onSetGoal,
  currentYear,
  finishedThisYear,
  onClose,
}: {
  books: Book[];
  justHitMilestone: number | null;
  upcomingMilestone: number;
  milestoneRemaining: number;
  personality: { title: string; blurb: string } | null;
  goal: ReadingGoal | null | undefined;
  savingGoal: boolean;
  onSetGoal: () => void;
  currentYear: number;
  finishedThisYear: number;
  onClose: () => void;
}) {
  const streak = useMemo(() => computeReadingStreak(books), [books]);
  const pages = useMemo(() => computePagesMilestone(books), [books]);
  const achievements = useMemo(() => computeAchievements(books), [books]);

  const goalPercent = goal ? Math.min(100, Math.round((finishedThisYear / goal.goal) * 100)) : 0;
  const pagesPercent = Math.min(
    100,
    Math.round(((pages.upcoming - pages.remaining) / pages.upcoming) * 100)
  );

  return (
    <SidePanel title="🏆 Milestones" onClose={onClose}>
      <div className="space-y-5">
        <div>
          {justHitMilestone ? (
            <p className="text-sm text-amber-800 font-medium">
              You just hit {justHitMilestone} books finished!
            </p>
          ) : (
            <>
              <p className="text-sm text-stone-600">
                {milestoneRemaining} more book{milestoneRemaining === 1 ? "" : "s"} to your{" "}
                {upcomingMilestone}th finish.
              </p>
              <div className="h-2 rounded-full bg-stone-100 overflow-hidden mt-2">
                <div
                  className="h-full bg-brass rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((upcomingMilestone - milestoneRemaining) / upcomingMilestone) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
            </>
          )}
        </div>

        {streak && streak.months >= 2 && (
          <div className="pt-4 border-t border-stone-100">
            <p className="text-xs uppercase tracking-wide text-stone-500 mb-1">Reading Streak</p>
            <p className="text-2xl font-bold text-ink">{streak.months} months</p>
            <p className="text-xs text-stone-500 mt-0.5">
              At least one finish every month since {streak.sinceLabel} — keep it going.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-stone-100">
          <p className="text-xs uppercase tracking-wide text-stone-500 mb-1">
            Pages Read (All-Time)
          </p>
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-sm text-stone-600">{pages.totalPages.toLocaleString()} pages</p>
            <p className="text-xs text-stone-500">
              {pages.remaining.toLocaleString()} to {pages.upcoming.toLocaleString()}
            </p>
          </div>
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full bg-brass rounded-full"
              style={{ width: `${pagesPercent}%` }}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wide text-stone-500">
              {currentYear} Reading Goal
            </p>
            <button
              type="button"
              className="text-xs text-brass hover:underline"
              onClick={onSetGoal}
              disabled={savingGoal}
            >
              {goal ? "Edit" : "Set a goal"}
            </button>
          </div>
          {goal ? (
            <>
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-sm text-stone-600">
                  {finishedThisYear} of {goal.goal} books
                </p>
                <p className="text-xs text-stone-500">{goalPercent}%</p>
              </div>
              <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full bg-brass rounded-full transition-all"
                  style={{ width: `${goalPercent}%` }}
                />
              </div>
              {finishedThisYear >= goal.goal && (
                <p className="text-xs text-emerald-700 mt-1.5">🎉 Goal reached!</p>
              )}
            </>
          ) : (
            <p className="text-sm text-stone-500">
              Set a goal to track your progress toward {currentYear}&rsquo;s reading.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-stone-100">
          <p className="text-xs uppercase tracking-wide text-stone-500 mb-2">Achievements</p>
          <div className="grid grid-cols-2 gap-2">
            {achievements.map((a) => (
              <div
                key={a.id}
                title={a.detail}
                className={
                  "rounded-md border p-2.5 text-center " +
                  (a.unlocked
                    ? "border-amber-300 bg-amber-50"
                    : "border-stone-200 bg-stone-50 opacity-60")
                }
              >
                <p className="text-lg leading-none">{a.unlocked ? a.icon : "🔒"}</p>
                <p className="text-[11px] font-medium text-ink mt-1 leading-tight">{a.label}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">{a.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {personality && (
          <div className="pt-4 border-t border-stone-100">
            <p className="text-xs uppercase tracking-wide text-stone-500 mb-1">
              Reading Personality
            </p>
            <p className="font-semibold text-ink">{personality.title}</p>
            <p className="text-xs text-stone-500 mt-0.5">{personality.blurb}</p>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
