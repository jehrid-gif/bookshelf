import { randomUUID } from "crypto";
import type { Book } from "./types";

// Every column on the books table that can actually be written to, in
// INSERT order — kept in one place so the restore route and its validation
// stay in sync with the schema. Full fidelity restore (not the normal "add
// a book" path): trello_id, created_at, enrichment_status etc. are all
// preserved from the backup rather than regenerated, so a restore
// reproduces the library exactly as it was at export time.
//
// Deliberately excludes `length_category` — it's a GENERATED ALWAYS AS
// column (derived from `pages` by Postgres itself), so it comes back for
// free once `pages` is restored, and Postgres rejects any INSERT that
// tries to give a generated column an explicit value.
export const BACKUP_COLUMNS = [
  "trello_id",
  "title",
  "author",
  "genre",
  "series",
  "series_index",
  "series_position",
  "pages",
  "status",
  "owned",
  "format",
  "cover_type",
  "special_edition",
  "my_rating",
  "moods",
  "worlds",
  "priority",
  "date_added",
  "date_started",
  "date_finished",
  "description",
  "cover_url",
  "isbn",
  "board_pos",
  "created_at",
  "updated_at",
  "enrichment_status",
  "enrichment_checked_at",
  "is_reread",
] as const;

export interface NormalizeResult {
  row?: Record<string, unknown>;
  error?: string;
}

// Light structural normalization for a row from a previously-downloaded
// /api/export JSON backup — not a general-purpose CSV importer. Values that
// came from this app's own database already have the right shapes; this
// just fills in anything a hand-edited file might have dropped and leaves
// real value validation (genre/status/world enums, etc.) to the database's
// own CHECK constraints, whose error surfaces back to the caller as-is.
export function normalizeBackupRow(raw: any, index: number): NormalizeResult {
  if (!raw || typeof raw !== "object") {
    return { error: `Row ${index + 1}: not an object.` };
  }
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    return { error: `Row ${index + 1}: missing a title.` };
  }

  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === "" ? null : Number(v);

  const row: Record<string, unknown> = {
    trello_id: typeof raw.trello_id === "string" && raw.trello_id ? raw.trello_id : randomUUID(),
    title,
    author: raw.author ?? null,
    genre: raw.genre ?? null,
    series: raw.series ?? null,
    series_index: num(raw.series_index),
    series_position: raw.series_position ?? null,
    pages: num(raw.pages),
    // length_category is intentionally omitted — see the BACKUP_COLUMNS
    // comment above; Postgres derives it from `pages` on its own.
    status: raw.status ?? "to_read",
    owned: raw.owned ?? true,
    format: raw.format ?? null,
    cover_type: raw.cover_type ?? null,
    special_edition: raw.special_edition ?? false,
    my_rating: num(raw.my_rating),
    moods: Array.isArray(raw.moods) ? raw.moods : [],
    worlds: Array.isArray(raw.worlds) ? raw.worlds : [],
    priority: raw.priority ?? false,
    date_added: raw.date_added ?? null,
    date_started: raw.date_started ?? null,
    date_finished: raw.date_finished ?? null,
    description: raw.description ?? null,
    cover_url: raw.cover_url ?? null,
    isbn: raw.isbn ?? null,
    board_pos: num(raw.board_pos) ?? index,
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? new Date().toISOString(),
    enrichment_status: raw.enrichment_status ?? null,
    enrichment_checked_at: raw.enrichment_checked_at ?? null,
    is_reread: raw.is_reread ?? false,
  };

  return { row };
}

export type BackupRow = Record<(typeof BACKUP_COLUMNS)[number], unknown>;


