import { query } from "./db";
import type { Book } from "./types";

// Full, restorable snapshot of the library — every column of every book, in
// the exact shape /api/admin/restore expects back. Shared by the on-demand
// Debug page download and the weekly emailed backup so both produce
// identical, restore-compatible files.
export async function getBooksBackupJson(): Promise<{ json: string; count: number }> {
  const books = await query<Book>(`SELECT * FROM books ORDER BY board_pos ASC`);
  return { json: JSON.stringify(books, null, 2), count: books.length };
}
