// Minimal CSV writer, good enough for spreadsheet imports (Excel, Google
// Sheets, Numbers all read this dialect) — quotes a cell only when it
// contains a comma, quote, or newline, doubling any embedded quotes.
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface CsvColumn {
  key: string;
  label: string;
}

export function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(","));
  // CRLF is the CSV-spec line ending and what Excel expects.
  return [header, ...lines].join("\r\n") + "\r\n";
}
