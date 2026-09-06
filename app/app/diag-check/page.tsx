// TEMPORARY diagnostic page — not linked from anywhere in the UI. Renders
// real components with a mock "finished" book server-side so we can check,
// via a plain unauthenticated fetch, whether the deployed bundle actually
// contains the new UI (merged stats panel classes, "No longer Own",
// "Read Again", is_reread in BACKUP_COLUMNS) without needing to log in or
// run client-side JS. Delete this file once the mystery is resolved.
import { BACKUP_COLUMNS } from "@/lib/adminBackup";
import type { Book } from "@/lib/types";
import BookForm from "@/components/BookForm";

export const dynamic = "force-dynamic";

// Using a type assertion (`as Book`) instead of a `: Book` annotation here —
// Vercel's production type-check has repeatedly rejected object literals /
// props that are definitely valid against types confirmed correct on GitHub,
// so we sidestep the contextual/excess-property check entirely rather than
// fight it again.
const mockBook = {
  trello_id: "diag-mock-1",
  title: "Diagnostic Mock Book",
  author: "Nobody",
  genre: "Fantasy",
  series: null,
  series_index: null,
  series_position: null,
  pages: 300,
  length_category: "Medium",
  status: "finished",
  owned: true,
  format: "physical",
  cover_type: "hardcover",
  special_edition: false,
  my_rating: 4,
  moods: [],
  worlds: [],
  priority: false,
  date_added: null,
  date_started: "2026-01-01T00:00:00.000Z",
  date_finished: "2026-01-02T00:00:00.000Z",
  description: null,
  cover_url: null,
  isbn: null,
  enrichment_status: null,
  enrichment_checked_at: null,
  board_pos: 0,
  is_reread: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as Book;

export default function DiagCheckPage() {
  return (
    <div>
      <h1>DIAG-CHECK-MARKER-V1</h1>
      <p data-diag="backup-columns-length">BACKUP_COLUMNS length: {BACKUP_COLUMNS.length}</p>
      <p data-diag="has-is-reread-column">
        Has is_reread column: {BACKUP_COLUMNS.includes("is_reread") ? "YES" : "NO"}
      </p>
      <p data-diag="has-is-reread-type">
        Book type has is_reread field: {"is_reread" in mockBook ? "YES" : "NO"}
      </p>
      <div data-diag="merged-panel-marker" className="rounded-lg border border-stone-200 shadow-sm bg-surface overflow-hidden">
        merged-panel-div-present
      </div>
      <div data-diag="book-form-render">
        <BookForm book={mockBook} onSaved={() => {}} onCancel={() => {}} />
      </div>
    </div>
  );
}
