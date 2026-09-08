"use client";

// A tiny up/down arrow pair used in "reorder mode" on the Insights page and
// Milestones panel — moving a box is one click instead of a round trip
// asking for a code change every time two boxes should swap places.
export default function ReorderControls({
  onUp,
  onDown,
  disableUp,
  disableDown,
}: {
  onUp: () => void;
  onDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  const base =
    "w-6 h-6 flex items-center justify-center rounded border text-[10px] leading-none transition-colors";
  const active = "border-stone-300 bg-surface text-stone-600 hover:bg-stone-100 hover:text-ink";
  const disabled = "border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed";
  return (
    <div className="flex items-center gap-1 flex-none">
      <button
        type="button"
        aria-label="Move up"
        title="Move up"
        onClick={onUp}
        disabled={disableUp}
        className={`${base} ${disableUp ? disabled : active}`}
      >
        ▲
      </button>
      <button
        type="button"
        aria-label="Move down"
        title="Move down"
        onClick={onDown}
        disabled={disableDown}
        className={`${base} ${disableDown ? disabled : active}`}
      >
        ▼
      </button>
    </div>
  );
}
