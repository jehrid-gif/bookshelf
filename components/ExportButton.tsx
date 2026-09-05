"use client";

export default function ExportButton() {
  return (
    <a href="/api/export" className="btn btn-secondary" download>
      ⬇ Export / Backup
    </a>
  );
}
