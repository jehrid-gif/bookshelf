"use client";

import { useCallback, useEffect, useState } from "react";

// Cross-device layout memory for reorderable panels (the Insights page, the
// Milestones panel) — persisted server-side in the `panel_layout` table
// rather than localStorage, so a reorder done on one device shows up
// everywhere else too, the same reasoning as the taste-match snapshot.
//
// `defaultOrder` is the shipped order for a panel's full set of section
// ids. Anything the user hasn't customized yet falls back to it, any id
// missing from a saved order (a section shipped after they last
// customized this panel) gets appended at its default position instead of
// silently vanishing, and any saved id no longer recognized (a section
// that no longer exists) is dropped.
export function useSectionOrder(panel: string, defaultOrder: string[]) {
  const [order, setOrder] = useState<string[]>(defaultOrder);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/panel-layout/${panel}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const saved: unknown = data?.order;
        if (Array.isArray(saved) && saved.length) {
          const known = new Set(defaultOrder);
          const kept = saved.filter(
            (id): id is string => typeof id === "string" && known.has(id)
          );
          const missing = defaultOrder.filter((id) => !kept.includes(id));
          setOrder([...kept, ...missing]);
        }
      })
      .catch(() => {
        // Best-effort — if the fetch fails, the default order stands.
      });
    return () => {
      cancelled = true;
    };
    // Only re-fetch when the panel identity changes, not on every render —
    // defaultOrder is typically a fresh array literal from the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  const persist = useCallback(
    (next: string[]) => {
      setOrder(next);
      fetch(`/api/panel-layout/${panel}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next }),
      }).catch(() => {});
    },
    [panel]
  );

  // Moves `id` one step within the currently-VISIBLE subsequence
  // (visibleIds — the caller filters `order` down to sections that
  // actually have something to show right now), then applies that as a
  // swap on the full stored order. Operating on the visible subsequence
  // means a hidden section (no data yet, e.g. no reread logged) never sits
  // between two visible ones and silently absorbs a click with no
  // observable effect.
  const move = useCallback(
    (id: string, direction: "up" | "down", visibleIds: string[]) => {
      const visIdx = visibleIds.indexOf(id);
      if (visIdx === -1) return;
      const swapWithId = direction === "up" ? visibleIds[visIdx - 1] : visibleIds[visIdx + 1];
      if (!swapWithId) return;
      const a = order.indexOf(id);
      const b = order.indexOf(swapWithId);
      if (a === -1 || b === -1) return;
      const next = [...order];
      [next[a], next[b]] = [next[b], next[a]];
      persist(next);
    },
    [order, persist]
  );

  const reset = useCallback(() => persist(defaultOrder), [persist, defaultOrder]);

  return { order, move, reset };
}
