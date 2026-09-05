"use client";

import { useState } from "react";
import { MOODS } from "@/lib/types";

export default function MoodPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (moods: string[]) => void;
}) {
  const [open, setOpen] = useState(value.length === 0);

  function toggle(mood: string) {
    if (value.includes(mood)) {
      onChange(value.filter((m) => m !== mood));
    } else {
      onChange([...value, mood]);
    }
  }

  return (
    <div className="border border-stone-200 rounded-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-stone-700"
      >
        <span>
          Moods{" "}
          {value.length > 0 && (
            <span className="text-stone-400 font-normal">
              ({value.length} selected)
            </span>
          )}
        </span>
        <span className="text-stone-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-wrap gap-2">
          {MOODS.map((mood) => {
            const selected = value.includes(mood);
            return (
              <button
                type="button"
                key={mood}
                onClick={() => toggle(mood)}
                className={
                  "badge border " +
                  (selected
                    ? "bg-brass/10 border-brass text-amber-900"
                    : "bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300")
                }
              >
                {mood}
              </button>
            );
          })}
        </div>
      )}
      {!open && value.length > 0 && (
        <div className="px-3 pb-3 flex flex-wrap gap-1.5">
          {value.map((m) => (
            <span key={m} className="badge bg-brass/10 text-amber-900">
              {m}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
