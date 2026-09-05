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

function colorFor(g: string) {
  return g === "Unclassified" ? UNCLASSIFIED_COLOR : GENRE_COLORS[g] || UNCLASSIFIED_COLOR;
}

export default function GenreTrendChart({ books }: { books: Book[] }) {
  const [hoverYear, setHoverYear] = useState<string | null>(null);

  const { years, maxTotal } = useMemo(() => {
    const byYear = new Map<string, Record<string, number>>();
    for (const b of books) {
      if (b.status !== "finished" || !b.date_finished) continue;
      const year = new Date(b.date_finished).getFullYear().toString();
      const key = b.genre || "Unclassified";
      if (!byYear.has(year)) byYear.set(year, {});
      const rec = byYear.get(year)!;
      rec[key] = (rec[key] || 0) + 1;
    }
    const yearsArr = Array.from(byYear.entries())
      .map(([year, counts]) => ({
        year,
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => Number(a.year) - Number(b.year));
    const max = Math.max(1, ...yearsArr.map((y) => y.total));
    return { years: yearsArr, maxTotal: max };
  }, [books]);

  if (years.length === 0) {
    return (
      <p className="text-sm text-stone-500">Finish a few books to see genre trends here.</p>
    );
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
      <div className="overflow-x-auto">
        <div className="flex items-end gap-3 pb-1" style={{ minHeight: CHART_HEIGHT + 28 }}>
          {years.map((y) => (
            <div
              key={y.year}
              className="relative flex flex-col items-center justify-end flex-none"
              style={{ width: 34 }}
              onMouseEnter={() => setHoverYear(y.year)}
              onMouseLeave={() => setHoverYear((h) => (h === y.year ? null : h))}
            >
              {hoverYear === y.year && (
                <div className="absolute bottom-full mb-2 z-10 w-44 rounded-md border border-stone-200 bg-white shadow-lg p-2.5 text-xs left-1/2 -translate-x-1/2">
                  <p className="font-semibold text-ink mb-1.5">
                    {y.year} — {y.total} finished
                  </p>
                  <div className="space-y-0.5">
                    {CATEGORIES.filter((g) => y.counts[g]).map((g) => (
                      <p key={g} className="flex items-center justify-between gap-2 text-stone-600">
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="inline-block w-2 h-2 rounded-sm flex-none"
                            style={{ background: colorFor(g) }}
                          />
                          <span className="truncate">{g}</span>
                        </span>
                        <span className="flex-none font-medium text-ink">{y.counts[g]}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <div
                className="w-full flex flex-col rounded-t overflow-hidden cursor-default"
                style={{ height: Math.max(4, (y.total / maxTotal) * CHART_HEIGHT) }}
              >
                {CATEGORIES.filter((g) => y.counts[g]).map((g) => (
                  <div
                    key={g}
                    style={{
                      height: `${(y.counts[g] / y.total) * 100}%`,
                      background: colorFor(g),
                    }}
                    className="w-full border-t-2 border-white first:border-t-0"
                  />
                ))}
              </div>
              <p className="text-[11px] text-stone-500 mt-1.5">{y.year}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
