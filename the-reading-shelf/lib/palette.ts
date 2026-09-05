// Deterministic "spine color" placeholder used whenever a book has no real
// cover image yet. Shared by BookDetail, the board cards, the library table,
// and BookCover so they all hash to the same color for the same book.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

const PALETTE = [
  { bg: "#5B2A2A", fg: "#F4E9DA" },
  { bg: "#1F3B57", fg: "#F0EAD9" },
  { bg: "#2F4B3C", fg: "#F1ECDC" },
  { bg: "#6B4A21", fg: "#F5EEDD" },
  { bg: "#43264A", fg: "#F1E7EE" },
  { bg: "#204A47", fg: "#EDF3EF" },
  { bg: "#7A3B22", fg: "#F7ECDD" },
  { bg: "#33312B", fg: "#EDE6D3" },
  { bg: "#4B4A1F", fg: "#F2EEDA" },
  { bg: "#5C1F33", fg: "#F5E6EA" },
  { bg: "#33465C", fg: "#EAEEF2" },
  { bg: "#7C5A1E", fg: "#FBF0DA" },
];

export function paletteFor(book: { title: string; author: string | null }) {
  return PALETTE[hashStr(`${book.title}|${book.author || ""}`) % PALETTE.length];
}
