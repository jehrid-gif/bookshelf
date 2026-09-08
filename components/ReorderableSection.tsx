"use client";

import ReorderControls from "./ReorderControls";

// Wraps one box on the Insights page or one section of the Milestones
// panel. In normal use it's just `children` — no visual change at all.
// While reordering is active it grows a small labeled toolbar above the
// content instead of overlaying arrows on top of it, so it never collides
// with a card's own header buttons (the Reading Goal's "Edit" link,
// clickable book covers, etc.) no matter how that content is laid out.
export default function ReorderableSection({
  label,
  reordering,
  onUp,
  onDown,
  disableUp,
  disableDown,
  className,
  children,
}: {
  label: string;
  reordering: boolean;
  onUp: () => void;
  onDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      {reordering && (
        <div className="flex items-center justify-between gap-2 mb-1.5 rounded-md border border-dashed border-stone-300 bg-stone-50 px-2 py-1">
          <span className="text-[10px] uppercase tracking-wide text-stone-500 font-medium truncate">
            {label}
          </span>
          <ReorderControls
            onUp={onUp}
            onDown={onDown}
            disableUp={disableUp}
            disableDown={disableDown}
          />
        </div>
      )}
      {children}
    </div>
  );
}
