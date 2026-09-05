"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeSwitcher from "./ThemeSwitcher";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/library", label: "Library" },
  { href: "/year-in-review", label: "Year in Review" },
  { href: "/releases", label: "Upcoming Releases" },
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
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LINKS.map((l) => (
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
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <ThemeSwitcher />
          <button
            onClick={handleLogout}
            className="text-xs text-stone-400 hover:text-stone-600"
            type="button"
          >
            Log out
          </button>
          <Link href="/library?new=1" className="btn btn-primary">
            + Add Book
          </Link>
        </div>
      </div>
    </header>
  );
}
