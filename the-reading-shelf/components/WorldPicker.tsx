"use client";

import { WORLDS } from "@/lib/types";

export default function WorldPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (worlds: string[]) => void;
}) {
  function toggle(world: string) {
    if (value.includes(world)) {
      onChange(value.filter((w) => w !== world));
    } else {
      onChange([...value, world]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {WORLDS.map((world) => {
        const selected = value.includes(world);
        return (
          <button
            type="button"
            key={world}
            onClick={() => toggle(world)}
            className={
              "badge border " +
              (selected
                ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                : "bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300")
            }
          >
            {world}
          </button>
        );
      })}
    </div>
  );
}
