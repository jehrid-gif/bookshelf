"use client";

import ReorderControls from "./ReorderControls";

// Wraps one box on the Insights page or one section of the Milestones
// panel. In normal use it's just `children` — no visual change at all.
// While reordering is active it grows a small labeled toolbar above the
// content instead of overlaying arrows on top of it, so it never collides
// with a card's own header buttons (the Reading Goal's "Edit" link,
// clickable book covers, etc.) no matter how that content is laid out.
//
// On the Insights grid, a CSS Grid row already stretches every item in it
// to match its tallest sibling (the default `align-items: stretch`), but
// that stretch only reaches this outer wrapper — the `.card` element inside
// `children` still sizes to its own content unless told otherwise, which is
// why two boxes in the same row can end up different heights with one
// card's border stopping short of the row's bottom. The flex column below
// plus `[&>.card]:h-full` closes that gap: the card (or the clickable
// `button.card` some sections use) is stretched to fill the space left
// after the reorder toolbar, so every box's visible border reaches the same
// bottom edge as its row-mate. Harmless outside a stretched grid (the
// Milestones panel's plain, unwrapped sections) since there's no `.card`
// there for the selector to match.
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
    <div className={`flex flex-col${className ? ` ${className}` : ""}`}>
      {reordering && (
        <div className="flex-none flex items-center justify-between gap-2 mb-1.5 rounded-md border border-dashed border-stone-300 bg-stone-50 px-2 py-1">
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
      <div className="flex-1 min-h-0 [&>.card]:h-full">{children}</div>
    </div>
  );
}
