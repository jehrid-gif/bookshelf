"use client";

import { useState } from "react";

// The shared "Search + Filters" shell: a search box plus a toggle button
// that reveals whatever filter controls the caller passes as children.
// Used by both the Library page and the Dashboard's embedded board.
export default function SearchFilterBar({
  search,
  onSearchChange,
  placeholder = "Search title or author…",
  children,
  resultsLabel,
  rightSlot,
  open: openProp,
  onOpenChange,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
  resultsLabel?: string;
  rightSlot?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;
  function setOpen(v: boolean) {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          className="input flex-1 min-w-[180px]"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {children && (
          <button
            type="button"
            className={"btn " + (open ? "btn-primary" : "btn-secondary")}
            onClick={() => setOpen(!open)}
          >
            ⚙ Filters
          </button>
        )}
        {rightSlot}
      </div>
      {resultsLabel && <p className="text-xs text-stone-500">{resultsLabel}</p>}
      {open && children && (
        <div className="pt-3 border-t border-stone-200">{children}</div>
      )}
    </div>
  );
}
