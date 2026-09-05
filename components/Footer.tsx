import Link from "next/link";

// Deliberately understated — these are safety-net tools (backup/restore,
// change history + undo), not everyday navigation, so they live in small
// muted text at the bottom of every page rather than in the main nav.
export default function Footer() {
  return (
    <footer className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-center gap-3 text-[11px] text-stone-400">
      <Link href="/history" className="hover:text-stone-500">
        Change Log
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/debug" className="hover:text-stone-500">
        Debug &amp; Backup
      </Link>
    </footer>
  );
}
