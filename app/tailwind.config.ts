import type { Config } from "tailwindcss";

// Every theme-aware color resolves through a CSS variable (set per
// [data-theme] in globals.css) so existing utility classes like bg-white,
// border-stone-200, text-stone-500, bg-parchment/60, etc. automatically
// repaint when the theme changes — no need to touch every component.
function themed(varName: string) {
  return `rgb(var(${varName}) / <alpha-value>)`;
}

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: themed("--color-page"),
        surface: themed("--color-surface"),
        ink: themed("--color-ink"),
        brass: themed("--color-brass"),
        stone: {
          50: themed("--stone-50"),
          100: themed("--stone-100"),
          200: themed("--stone-200"),
          300: themed("--stone-300"),
          400: themed("--stone-400"),
          500: themed("--stone-500"),
          600: themed("--stone-600"),
          700: themed("--stone-700"),
          800: "#292524",
          900: "#1c1917",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-body)", "ui-serif", "Georgia", "serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
