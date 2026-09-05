// Barcode scans and hand-typed ISBNs both need to be compared and looked up
// the same way regardless of the dashes/spaces a source happened to include.
// ISBN-10 checksums can end in a literal "X", so that's kept (uppercased);
// everything else that isn't a digit is stripped.
export function normalizeIsbn(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9X]/g, "");
}
