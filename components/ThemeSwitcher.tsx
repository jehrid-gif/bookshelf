"use client";

import { useEffect, useRef, useState } from "react";
import { THEMES } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

// A discreet little swatch button, tucked into the corner of the nav —
// clicking it drops down the four theme choices as swatch dots.
export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = THEMES.find((t) => t.id === theme) || THEMES[0];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Color theme"
        aria-label="Change color theme"
        className="w-5 h-5 rounded-full border border-stone-300 shadow-sm flex-none"
        style={{
          background: `linear-gradient(135deg, ${current.swatch[0]} 50%, ${current.swatch[1]} 50%)`,
        }}
      />
      {open && (
        <div className="absolute right-0 mt-2 z-40 w-44 rounded-md border border-stone-200 bg-surface shadow-lg p-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className={
                "w-full flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left hover:bg-stone-100 " +
                (t.id === theme ? "font-semibold text-ink" : "text-stone-600")
              }
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-stone-300 flex-none"
                style={{
                  background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)`,
                }}
              />
              {t.label}
              {t.id === theme && <span className="ml-auto text-brass">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
