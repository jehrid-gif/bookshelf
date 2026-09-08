"use client";

import { useEffect } from "react";

// A slide-over panel anchored to the right edge — used for things you dip
// into alongside the page (Reading queue, Discover) rather than a modal
// dialog that fully blocks the page.
export default function SidePanel({
  title,
  onClose,
  children,
  widthClass = "max-w-md",
  headerExtra,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthClass?: string;
  // Optional small action rendered in the header, between the title and the
  // close button — e.g. a panel's own "Reorder" toggle. Omitted by default
  // so every other panel keeps its exact existing header.
  headerExtra?: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className={`w-full ${widthClass} h-full bg-surface shadow-xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3 flex-none gap-3">
          <h2 className="text-lg font-semibold text-ink font-display truncate">{title}</h2>
          <div className="flex items-center gap-3 flex-none">
            {headerExtra}
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-700 text-xl leading-none"
              aria-label="Close"
              type="button"
            >
              ×
            </button>
          </div>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
