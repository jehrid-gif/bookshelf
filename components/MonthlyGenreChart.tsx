"use client";

import { useMemo, useState } from "react";
import type { Book } from "@/lib/types";
import { GENRES } from "@/lib/types";

const GENRE_COLORS: Record<string, string> = {
  Fantasy: "#2a78d6",
  "Science Fiction": "#eb6834",
  Horror: "#1baf7a",
  "Thriller/Mystery/Crime": "#eda100",
  "Historical/Literary Fiction": "#e87ba4",
  Nonfiction: "#008300",
};
const UNCLASSIFIED_COLOR = "#c3c2b7";
const CATEGORIES = [...GENRES, "Unclassified"];
const CHART_HEIGHT = 150;
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function colorFor(g: string) {
  return g === "Unclassified" ? UNCLASSIFIED_COLOR : GENRE_COLORS[g] || UNCLASSIFIED_COLOR;
}

// Same visual language as the old cross-year Genre Trend chart, but scoped
// to one year and bucketed by month instead of by year — shows how reading
// taste moved around within a single year.
export default function MonthlyGenreChart({ books }: { books: Book[] }) {
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);

  const { months, maxTotal } = useMemo(() => {
    const byMonth: Record<string, number>[] = Array.from({ length: 12 }, () => ({}));
    for (const b of books) {
      if (!b.date_finished) continue;
      const m = new Date(b.date_finished).getMonth();
      const key = b.genre || "Unclassified";
      byMonth[m][key] = (byMonth[m][key] || 0) + 1;
    }
    const arr = byMonth.map((counts, m) => ({
      month: m,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    }));
    const max = Math.max(1, ...arr.map((y) => y.total));
    return { months: arr, maxTotal: max };
  }, [books]);

  if (books.length === 0) {
    return <p className="text-sm text-stone-500">No finished books with a date this year yet.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4 text-xs">
        {CATEGORIES.map((g) => (
          <span key={g} className="flex items-center gap-1.5 text-stone-600">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm flex-none"
              style={{ background: colorFor(g) }}
            />
            {g}
          </span>
        ))}
      </div>
      <div className="flex items-end gap-2 sm:gap-3 pb-1" style={{ minHeight: CHART_HEIGHT + 28 }}>
          {months.map((m) => {
            const isFirst = m.month === 0;
            const isLast = m.month === 11;
            return (
            <div
              key={m.month}
              className="relative flex flex-col items-center justify-end flex-1 min-w-0"
              style={{ maxWidth: 60 }}
              onMouseEnter={() => setHoverMonth(m.month)}
              onMouseLeave={() => setHoverMonth((h) => (h === m.month ? null : h))}
            >
              {hoverMonth === m.month && m.total > 0 && (
                <div
                  className={
                    "absolute bottom-full mb-2 z-10 w-44 rounded-md border border-stone-200 bg-surface shadow-lg p-2.5 text-xs " +
                    (isFirst ? "left-0" : isLast ? "right-0" : "left-1/2 -translate-x-1/2")
                  }
                >
                  <p className="font-semibold text-ink mb-1.5">
                    {MONTH_ABBR[m.month]} — {m.total} finished
                  </p>
                  <div className="space-y-0.5">
                    {CATEGORIES.filter((g) => m.counts[g]).map((g) => (
                      <p key={g} className="flex items-center justify-between gap-2 text-stone-600">
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="inline-block w-2 h-2 rounded-sm flex-none"
                            style={{ background: colorFor(g) }}
                          />
                          <span className="truncate">{g}</span>
                        </span>
                        <span className="flex-none font-medium text-ink">{m.counts[g]}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <div
                className="w-full flex flex-col rounded-t overflow-hidden cursor-default bg-stone-100"
                style={{ height: Math.max(4, (m.total / maxTotal) * CHART_HEIGHT) }}
              >
                {CATEGORIES.filter((g) => m.counts[g]).map((g) => (
                  <div
                    key={g}
                    style={{
                      height: `${(m.counts[g] / m.total) * 100}%`,
                      background: colorFor(g),
                    }}
                    className="w-full border-t-2 border-surface first:border-t-0"
                  />
                ))}
              </div>
              <p className="text-[11px] text-stone-500 mt-1.5">{MONTH_ABBR[m.month]}</p>
            </div>
            );
          })}
      </div>
    </div>
  );
}
