import { createHash } from 'node:crypto';

export const DD_SOURCE = 'ATT_DD';
export const MAX_REPORT_BYTES = 12 * 1024 * 1024;
export const MAX_REPORT_ROWS = 10_000;

export interface DDNormalizedRow {
  externalRepId: string;
  reportName: string;
  generated: number;
  commissionToIcd: number;
  ecBonusToIcd: number;
  adjustmentToIcd: number;
  bonusesToIcd: number;
  noEcBonusReason?: string;
  tier?: string;
  retail?: string;
  store?: string;
  orderType?: string;
  raw: Record<string, string>;
}

export interface DDParsedReport {
  reportType: 'DD_BY_REP' | 'DD_DETAIL';
  processedWeek: string;
  ddWeek: string;
  rows: DDNormalizedRow[];
  warnings: string[];
  hash: string;
}

const money = (value: unknown) => {
  const number = Number.parseFloat(String(value ?? '').replace(/[$,()\s]/g, match => match === '(' ? '-' : ''));
  return Number.isFinite(number) ? number : 0;
};
const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const key = (value: string) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
const get = (row: Record<string, string>, ...names: string[]) => {
  const wanted = names.map(key);
  const entry = Object.entries(row).find(([column]) => wanted.includes(key(column)));
  return clean(entry?.[1]);
};

export function parseDate(value: string): string | null {
  const match = value.match(/(20\d{2})[-/]([01]?\d)[-/]([0-3]?\d)|([01]?\d)[-/]([0-3]?\d)[-/](20\d{2})/);
  if (!match) return null;
  const year = match[1] ?? match[6];
  const month = match[2] ?? match[4];
  const day = match[3] ?? match[5];
  const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function splitDelimited(text: string): string[][] {
  return text.split(/\r?\n/).filter(Boolean).map(line => {
    const delimiter = line.includes('\t') ? '\t' : ',';
    const cells: string[] = [];
    let current = '';
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { cells.push(clean(current)); current = ''; }
      else current += char;
    }
    cells.push(clean(current));
    return cells;
  });
}

export function normalizeGrid(grid: string[][], sourceText: string): Omit<DDParsedReport, 'hash'> {
  const headerIndex = grid.findIndex(row => row.some(cell => /rep\s*(id|#)|company\s*id|agent\s*id/i.test(cell)));
  if (headerIndex < 0) throw new Error('Carrier rep ID column was not found. Export DD BY REP or DD DETAIL with company IDs included.');
  const headers = grid[headerIndex].map(clean);
  const rows: DDNormalizedRow[] = [];
  for (const values of grid.slice(headerIndex + 1)) {
    const raw = Object.fromEntries(headers.map((header, index) => [header || `column_${index + 1}`, clean(values[index])]));
    const externalRepId = get(raw, 'Rep ID', 'Company ID', 'Agent ID', 'Rep #', 'Sales Rep ID');
    const reportName = get(raw, 'Rep Name', 'Sales Rep', 'Agent Name', 'Name');
    if (!externalRepId || !reportName || !/^\d{4,}$/.test(externalRepId)) continue;
    const commission = money(get(raw, 'Commission Paid to ICD', 'Commission to ICD', 'Commission', 'DD Amount', 'Total Sums'));
    const ec = money(get(raw, 'EC Bonus to ICD', 'EC Bonus', 'EC'));
    const adjustment = money(get(raw, 'Adjustments', 'Adjustment to ICD', 'Adjustment'));
    const bonuses = money(get(raw, 'Bonuses to ICD', 'Bonuses', 'Bonus'));
    rows.push({
      externalRepId,
      reportName,
      commissionToIcd: commission,
      ecBonusToIcd: ec,
      adjustmentToIcd: adjustment,
      bonusesToIcd: bonuses,
      generated: money(get(raw, 'Total Sums', 'Total', 'Generated')) || commission + ec + adjustment + bonuses,
      noEcBonusReason: get(raw, 'No EC Bonus Reason', 'EC Bonus Reason') || undefined,
      tier: get(raw, 'Tier', 'Category') || undefined,
      retail: get(raw, 'Retail', 'Retailer') || undefined,
      store: get(raw, 'Store', 'Location') || undefined,
      orderType: get(raw, 'Order Type', 'Product') || undefined,
      raw,
    });
    if (rows.length > MAX_REPORT_ROWS) throw new Error(`Report exceeds the ${MAX_REPORT_ROWS.toLocaleString()} row limit.`);
  }
  if (!rows.length) throw new Error('No valid report rows with a carrier rep ID were found.');
  const reportType = /DD\s*DETAIL/i.test(sourceText) || headers.some(header => /order|retail|no ec bonus reason/i.test(header)) ? 'DD_DETAIL' : 'DD_BY_REP';
  const processed = sourceText.match(/processed\s*week(?:\s*ending)?\s*[:\-]?\s*([^\n]+)/i)?.[1] ?? '';
  const dd = sourceText.match(/(?:dd|direct deposit)\s*week(?:\s*ending)?\s*[:\-]?\s*([^\n]+)/i)?.[1] ?? '';
  const ddWeek = parseDate(dd) ?? parseDate(processed) ?? new Date().toISOString();
  const processedWeek = parseDate(processed) ?? ddWeek;
  const warnings: string[] = [];
  if (!parseDate(dd)) warnings.push('DD week was not labeled clearly; verify the detected date before confirmation.');
  return { reportType, processedWeek, ddWeek, rows, warnings };
}

export async function extractPdfGrid(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  if (document.numPages > 250) throw new Error('PDF exceeds the 250 page limit.');
  const grid: string[][] = [];
  let text = '';
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = new Map<number, Array<{ x: number; value: string }>>();
    for (const raw of content.items) {
      if (!('str' in raw) || !raw.str.trim()) continue;
      const y = Math.round(raw.transform[5] / 3) * 3;
      lines.set(y, [...(lines.get(y) ?? []), { x: raw.transform[4], value: raw.str.trim() }]);
    }
    for (const [, cells] of [...lines.entries()].sort((a, b) => b[0] - a[0])) {
      const row = cells.sort((a, b) => a.x - b.x).map(cell => cell.value);
      grid.push(row);
      text += `${row.join('\t')}\n`;
    }
  }
  await document.destroy();
  return { grid, text };
}

export function parseDelimitedReport(text: string): Omit<DDParsedReport, 'hash'> {
  return normalizeGrid(splitDelimited(text), text);
}

export function reportHash(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function summarizeRows(rows: DDNormalizedRow[]) {
  const map = new Map<string, { externalRepId: string; reportName: string; generated: number; ecBonusReceived: number; ecBonusMissing: number; detailCount: number; tier?: string }>();
  for (const row of rows) {
    const current = map.get(row.externalRepId) ?? { externalRepId: row.externalRepId, reportName: row.reportName, generated: 0, ecBonusReceived: 0, ecBonusMissing: 0, detailCount: 0, tier: row.tier };
    current.generated += row.generated;
    current.ecBonusReceived += row.ecBonusToIcd;
    current.detailCount += 1;
    // Missing is evidence-based: only report an amount when the export itself contains a negative adjustment.
    if (row.noEcBonusReason && row.ecBonusToIcd === 0 && row.adjustmentToIcd < 0) current.ecBonusMissing += Math.abs(row.adjustmentToIcd);
    map.set(row.externalRepId, current);
  }
  return [...map.values()];
}
