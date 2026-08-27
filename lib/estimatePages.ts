/**
 * Cheap client-side page-count estimate for the upload chip UI (e.g. "2 Pages").
 * Scans the raw PDF bytes for `/Type /Page` object markers. Works for most
 * simple, uncompressed-xref PDFs; returns null (chip omits the count) if it
 * can't find any, rather than showing a misleading "0 Pages".
 */
export async function estimatePageCount(file: File): Promise<number | null> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return 1;

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const text = new TextDecoder("latin1").decode(buf);
    const matches = text.match(/\/Type\s*\/Page(?!s)/g);
    return matches && matches.length > 0 ? matches.length : null;
  } catch {
    return null;
  }
}
