import { paletteFor } from "@/lib/palette";

// Renders a real cover image when we have one from Google Books, falling
// back to the deterministic "spine color" placeholder otherwise. Used
// everywhere a book's cover shows up: library table, board cards, detail
// modal, and the Add/Edit form's live preview.
export default function BookCover({
  book,
  className = "w-16 h-24",
  padding = "p-1.5",
  textSize = "text-[10px]",
  lineClamp = "line-clamp-5",
}: {
  book: { title: string; author: string | null; cover_url?: string | null };
  className?: string;
  padding?: string;
  textSize?: string;
  lineClamp?: string;
}) {
  if (book.cover_url) {
    return (
      <img
        src={book.cover_url}
        alt=""
        className={`${className} object-cover rounded-md shadow-sm flex-none bg-stone-100`}
      />
    );
  }
  const pal = paletteFor(book);
  return (
    <div
      className={`${className} ${padding} rounded-md shadow-sm flex items-end flex-none`}
      style={{ background: pal.bg, color: pal.fg }}
    >
      <p className={`font-semibold leading-tight ${lineClamp} ${textSize}`}>{book.title}</p>
    </div>
  );
}
