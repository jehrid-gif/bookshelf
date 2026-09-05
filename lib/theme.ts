// Metadata for the site's color themes — the actual color values live as CSS
// variables in globals.css (keyed by [data-theme]); this file just describes
// them for the picker UI (id to store/apply, label, and a couple of preview
// swatch colors so the picker can render a little dot without duplicating
// the full palette).
export interface ThemeOption {
  id: string;
  label: string;
  swatch: [string, string]; // [page bg, accent] — just for the picker preview
}

export const THEMES: ThemeOption[] = [
  { id: "parchment", label: "Parchment", swatch: ["#faf6ee", "#a9782f"] },
  { id: "midnight", label: "Midnight Study", swatch: ["#1a1d26", "#c98f47"] },
  { id: "forest", label: "Forest Library", swatch: ["#f1f4ec", "#2f5c3a"] },
  { id: "rosewood", label: "Rosewood", swatch: ["#faf0ee", "#8a2a3a"] },
];

export const DEFAULT_THEME = "parchment";
export const THEME_STORAGE_KEY = "reading-shelf-theme";
