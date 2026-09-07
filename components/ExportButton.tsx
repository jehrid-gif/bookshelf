"use client";

export default function ExportButton() {
  return (
    <a href="/api/export" className="btn btn-primary" download>
      ⬇ Export / Backup
    </a>
  );
}
