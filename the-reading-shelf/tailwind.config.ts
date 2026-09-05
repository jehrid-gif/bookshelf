import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: "#faf6ee",
        ink: "#2b2620",
        brass: "#a9782f",
      },
    },
  },
  plugins: [],
};
export default config;
