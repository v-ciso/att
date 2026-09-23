// Pulls promo rows out of a carrier promo sheet (PDF text table, XLSX or CSV).
//
// Deliberately conservative: this is a SUGGESTION engine feeding a
// preview-and-confirm diff, never a silent writer. Promos drive commission, and
// a mis-parsed row would quietly change what reps get paid, so anything
// ambiguous is dropped rather than guessed. The person reviewing the diff is the
// real gate.

export interface ParsedPromo {
  /** Device / plan the promo applies to, as printed on the sheet. */
  label: string;
  /** Credit or discount amount in dollars. */
  amount: number;
  /** Raw source line, kept so the reviewer can see what it came from. */
  source: string;
}

/** Strips currency formatting: "$1,000.00" -> 1000. Returns null if not money. */
export function parseMoney(raw: string): number | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  // Require a digit; reject bare "$" or "-".
  if (!/\d/.test(text)) return null;
  // Parenthesised negatives, e.g. "($50)".
  const negative = /^\(.*\)$/.test(text);
  const cleaned = text.replace(/[()$,\s]/g, '').replace(/USD$/i, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

// Lines that are obviously not promo rows: headers, totals, legal boilerplate.
const NOISE = /^(total|subtotal|grand total|notes?|terms|conditions|disclaimer|effective|page \d+|promo(tion)?s?|device|offer)s?\b/i;

/**
 * True when a label looks like a real product/promo name rather than a stray
 * fragment. Requires at least one letter and some substance, which filters out
 * page numbers and column rulers.
 */
function plausibleLabel(label: string): boolean {
  const trimmed = label.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  if (NOISE.test(trimmed)) return false;
  return true;
}

/**
 * Extracts promo rows from a grid of cells (from XLSX/CSV) or text lines
 * (from a PDF, pre-split into cells by x-position).
 *
 * Heuristic: a row contributes a promo when it has a plausible text label and
 * exactly one parseable money value. Rows with several money columns are
 * skipped, because we cannot tell which column is the credit without guessing —
 * and guessing wrong changes someone's paycheck.
 */
export function parsePromoRows(grid: string[][]): ParsedPromo[] {
  const out: ParsedPromo[] = [];
  const seen = new Set<string>();

  for (const row of grid ?? []) {
    if (!row || row.length < 2) continue;
    const cells = row.map(c => String(c ?? '').trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const money: number[] = [];
    const words: string[] = [];
    for (const cell of cells) {
      const amount = parseMoney(cell);
      if (amount !== null) money.push(amount);
      else words.push(cell);
    }

    // Exactly one money value keeps this unambiguous.
    if (money.length !== 1) continue;
    if (money[0] <= 0) continue;

    const label = words.join(' ').replace(/\s{2,}/g, ' ').trim();
    if (!plausibleLabel(label)) continue;

    // De-dupe on label+amount: promo sheets often repeat a row per store.
    const key = `${label.toLowerCase()}|${money[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ label, amount: money[0], source: cells.join(' | ') });
  }

  return out;
}

/**
 * Reads a File into a promo row grid. PDFs are grouped into visual lines by
 * y-position (same approach as the sales report importer); spreadsheets are read
 * sheet by sheet so a multi-tab promo book still parses.
 *
 * Returns { rows, error } rather than throwing: the caller shows the message
 * inline next to the upload.
 */
export async function extractPromoGrid(file: File): Promise<{ grid: string[][]; error?: string }> {
  try {
    const buf = await file.arrayBuffer();

    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs')).default;
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const grid: string[][] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const byLine = new Map<number, { x: number; s: string }[]>();
        content.items.forEach(it => {
          const item = it as { str: string; transform: number[] };
          if (!item.str.trim()) return;
          const y = Math.round(item.transform[5]);
          byLine.set(y, [...(byLine.get(y) ?? []), { x: item.transform[4], s: item.str }]);
        });
        Array.from(byLine.entries())
          .sort((a, b) => b[0] - a[0])
          .forEach(([, cells]) => grid.push(cells.sort((a, b) => a.x - b.x).map(c => c.s)));
      }
      if (!grid.length) {
        return { grid: [], error: 'No text found in this PDF. Scanned/image promo sheets cannot be parsed — try the spreadsheet version.' };
      }
      return { grid };
    }

    const { readTabularFile } = await import('@/lib/tabular-file');
    return { grid: await readTabularFile(file, true) };
  } catch {
    return { grid: [], error: 'Could not read that file. Supported: PDF, XLSX, CSV.' };
  }
}
