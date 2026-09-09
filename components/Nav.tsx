"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeSwitcher from "./ThemeSwitcher";

// Grouped rather than one flat list — Series used to sit right after
// Library with nothing to say it belonged there or with what came after.
// It's really a stats/reporting page like Year in Review and Insights, not
// a book-management page like Library, so it's grouped with those instead;
// a thin divider between groups makes that grouping visible in the nav
// itself rather than just in this comment.
const NAV_GROUPS: { href: string; label: string }[][] = [
  [
    { href: "/", label: "Dashboard" },
    { href: "/library", label: "Library" },
  ],
  [
    { href: "/series", label: "Series" },
    { href: "/year-in-review", label: "Year in Review" },
    { href: "/insights", label: "Insights" },
  ],
  [{ href: "/releases", label: "Upcoming Releases" }],
];

export default function Nav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="border-b border-stone-200 bg-surface">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/" className="text-lg font-display font-bold text-ink whitespace-nowrap">
          📚 The Reading Shelf
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {NAV_GROUPS.map((group, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {i > 0 && <span className="h-4 w-px bg-stone-300" aria-hidden="true" />}
              {group.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    pathname === l.href
                      ? "font-semibold text-brass"
                      : "text-stone-600 hover:text-ink"
                  }
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/library?new=1" className="btn btn-primary">
            + Add Book
          </Link>
          <ThemeSwitcher />
          <button
            onClick={handleLogout}
            className="text-xs text-stone-400 hover:text-stone-600"
            type="button"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
