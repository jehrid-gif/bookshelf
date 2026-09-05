import { randomUUID } from "crypto";
import { query } from "./db";

// Fields that change on nearly every save/drag but aren't meaningful for a
// "what did I actually change" history — logging these would drown the log
// in noise from routine drag-to-reorder and background cover/ISBN lookups.
const IGNORED_FIELDS = new Set([
  "board_pos",
  "updated_at",
  "enrichment_status",
  "enrichment_checked_at",
]);

function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): string[] {
  const keys = new Set([
    ...(before ? Object.keys(before) : []),
    ...(after ? Object.keys(after) : []),
  ]);
  const changed: string[] = [];
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const a = before ? before[key] : undefined;
    const b = after ? after[key] : undefined;
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(key);
  }
  return changed;
}

export interface LogChangeOpts {
  bookId: string;
  bookTitle: string;
  action: "created" | "updated" | "deleted";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

// Records one entry in the Change Log (see /history) — a running history of
// who-did-what to the library, separate from the books table itself so it
// survives even a book's own deletion. Best-effort: a logging failure must
// never block or fail the book mutation that triggered it.
export async function logChange(opts: LogChangeOpts): Promise<void> {
  try {
    const before = opts.before ?? null;
    const after = opts.after ?? null;
    const changedFields = opts.action === "updated" ? diffFields(before, after) : [];

    // A pure reorder or enrichment-only write has nothing meaningful to
    // show — skip it rather than clutter the log.
    if (opts.action === "updated" && changedFields.length === 0) return;

    await query(
      `INSERT INTO book_changes (id, book_id, book_title, action, before, after, changed_fields)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        randomUUID(),
        opts.bookId,
        opts.bookTitle,
        opts.action,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        changedFields,
      ]
    );
  } catch {
    // See above — never let history logging break the real operation.
  }
}
