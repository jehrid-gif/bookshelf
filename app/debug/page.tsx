"use client";

import { useEffect, useRef, useState } from "react";

const RESTORE_PHRASE = "REPLACE ALL BOOKS";
const WIPE_PHRASE = "DELETE ALL BOOKS";

export default function DebugPage() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/books")
      .then((res) => res.json())
      .then((data) => setCount(Array.isArray(data) ? data.length : null))
      .catch(() => setCount(null));
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">🛠 Debug &amp; Backup</h1>
        <p className="text-sm text-stone-500 mt-1">
          Disaster-recovery tools for your library data
          {count !== null && ` — currently ${count} book${count === 1 ? "" : "s"}`}.
          These only touch your books (not watched authors or cached upcoming
          releases, which rebuild on their own). Everything here is destructive
          by nature, so each action requires typing an exact confirmation phrase.
        </p>
      </div>

      <DownloadSection />
      <RestoreSection onChanged={setCount} />
      <WipeSection onChanged={setCount} />
    </div>
  );
}

function DownloadSection() {
  return (
    <div className="card space-y-2">
      <h2 className="font-semibold text-ink">⬇️ Download Backup</h2>
      <p className="text-sm text-stone-600">
        Downloads every field of every book as a JSON file — the format the
        Restore tool below expects. Worth grabbing one of these before you
        make any large change you're unsure about.
      </p>
      <a href="/api/export" download className="btn btn-secondary inline-flex">
        Download Backup (JSON)
      </a>
    </div>
  );
}

function RestoreSection({ onChanged }: { onChanged: (n: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<string[]>([]);

  const ready = fileName !== null && phrase === RESTORE_PHRASE && !busy;

  async function handleRestore() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    setError(null);
    setDetails([]);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      if (!Array.isArray(parsed)) {
        throw new Error(
          "That doesn't look like a backup file — expected a JSON array of books."
        );
      }
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: RESTORE_PHRASE, books: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Restore failed.");
        setDetails(data.details || []);
        return;
      }
      setResult(`Restored ${data.restored} books. Your library now matches the backup file.`);
      onChanged(data.restored);
      setPhrase("");
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 border-amber-300">
      <h2 className="font-semibold text-ink">📤 Restore From Backup</h2>
      <p className="text-sm text-stone-600">
        <strong>This replaces your entire library</strong> with whatever is in
        the file you pick — every book currently in the app is deleted first,
        then every book in the file is inserted. It happens in one all-or-nothing
        step, so a bad file leaves your current library untouched rather than
        half-replaced.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        className="input"
      />
      <div>
        <label className="label">
          Type <code className="text-ink">{RESTORE_PHRASE}</code> to enable this
        </label>
        <input
          type="text"
          className="input"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder={RESTORE_PHRASE}
        />
      </div>
      <button
        type="button"
        className="btn btn-danger"
        disabled={!ready}
        onClick={handleRestore}
      >
        {busy ? "Restoring…" : "Replace All Books From File"}
      </button>
      {result && <p className="text-sm text-emerald-700">{result}</p>}
      {error && (
        <div className="text-sm text-red-700">
          <p>{error}</p>
          {details.length > 0 && (
            <ul className="list-disc list-inside mt-1">
              {details.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function WipeSection({ onChanged }: { onChanged: (n: number) => void }) {
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = phrase === WIPE_PHRASE && !busy;

  async function handleWipe() {
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: WIPE_PHRASE }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      setResult(`Deleted ${data.deleted} books. Your library is now empty.`);
      onChanged(0);
      setPhrase("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 border-red-300">
      <h2 className="font-semibold text-ink">🗑️ Delete All Books</h2>
      <p className="text-sm text-stone-600">
        Permanently deletes every book. There's no undo — download a backup
        first if there's any chance you'll want this data again.
      </p>
      <div>
        <label className="label">
          Type <code className="text-ink">{WIPE_PHRASE}</code> to enable this
        </label>
        <input
          type="text"
          className="input"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder={WIPE_PHRASE}
        />
      </div>
      <button type="button" className="btn btn-danger" disabled={!ready} onClick={handleWipe}>
        {busy ? "Deleting…" : "Delete Everything"}
      </button>
      {result && <p className="text-sm text-emerald-700">{result}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
