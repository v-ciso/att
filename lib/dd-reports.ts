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
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== iso ? null : date.toISOString();
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

function tableauWeeks(sourceText: string) {
  const processedMatch = sourceText.match(/Processed Week[\s\S]{0,600}?(\d{1,2}\/\d{1,2}\/20\d{2})/i);
  const processedWeek = parseDate(processedMatch?.[1] ?? '');
  if (!processedWeek) throw new Error('Processed week is missing. Re-export the report with its date header.');
  const explicitDd = sourceText.match(/(?:DD|Direct Deposit) Week(?: Ending)?[ \t]*[:\-]?[ \t]*(\d{1,2}\/\d{1,2}\/20\d{2})/i);
  if (explicitDd) return { processedWeek, ddWeek: parseDate(explicitDd[1]) ?? processedWeek };
  const dates = [...sourceText.matchAll(/\b(\d{1,2}\/\d{1,2}\/20\d{2})\b/g)].map(match => parseDate(match[1])).filter((date): date is string => Boolean(date));
  const ddWeek = dates.filter(date => date !== processedWeek).sort((a, b) => dates.filter(date => date === b).length - dates.filter(date => date === a).length)[0];
  if (ddWeek) return { processedWeek, ddWeek };
  const priorDay = new Date(processedWeek);
  priorDay.setUTCDate(priorDay.getUTCDate() - 1);
  return { processedWeek, ddWeek: priorDay.toISOString() };
}

function normalizeTableauByRep(grid: string[][], sourceText: string): Omit<DDParsedReport, 'hash'> {
  const isAmount = (cell: string) => /^\(?\$[\d,]+(?:\.\d{2})?\)?$/.test(cell);
  const isProduct = (cell: string) => /^(?:WIRELESS\s*-|INTERNET\s*-|Internet Bonus|Wireless Bonus|Device Bonus|AIR$)/i.test(cell);
  const identities = grid.map((row, index) => row.some(cell => /Smart Circle/i.test(cell)) ? index : -1).filter(index => index >= 0);
  const starts = identities.map(index => {
    const previous = grid[index - 1]?.map(clean) ?? [];
    return previous.length && previous.every(cell => /^\d+$/.test(cell) || isProduct(cell)) ? index - 1 : index;
  });
  const rows: DDNormalizedRow[] = [];
  const warnings: string[] = ['DD week inferred from report metadata; verify before confirming.'];
  for (let blockIndex = 0; blockIndex < starts.length; blockIndex++) {
    const block = grid.slice(starts[blockIndex], starts[blockIndex + 1] ?? grid.length);
    const idIndex = block.findIndex(row => row.some(cell => /^\(\d{4,}\)$/.test(clean(cell))));
    if (idIndex < 0) throw new Error('A report rep has no readable carrier ID. Re-export the complete report.');
    const externalRepId = clean(block[idIndex].find(cell => /^\(\d{4,}\)$/.test(clean(cell)))).replace(/\D/g, '');
    const smartRow = grid[identities[blockIndex]];
    const smartIndex = smartRow.findIndex(cell => /Smart Circle/i.test(cell));
    let reportName = clean(smartRow[smartIndex - 1]);
    if (!reportName.includes(' ')) {
      const surname = block.slice(1, idIndex + 1).flat().find(cell => /^[A-Z][A-Za-z'’-]+$/.test(clean(cell)) && clean(cell) !== reportName && !/^(Wireless|Base|Campaign|AIR|Upgrade|BYOD)$/i.test(clean(cell)));
      if (surname) reportName = `${reportName} ${clean(surname)}`;
    }
    let description = '';
    let quantity = 0;
    let awaitingTotal = false;
    let reportedTotal: number | undefined;
    const firstRow = rows.length;
    for (const line of block) {
      const cells = line.map(clean).filter(Boolean);
      const amounts = cells.filter(isAmount);
      if (cells.some(cell => /^Rep Total$/i.test(cell))) {
        if (amounts.length) reportedTotal = money(amounts[0]);
        else awaitingTotal = true;
        description = ''; quantity = 0;
        continue;
      }
      if (awaitingTotal) {
        if (amounts.length) { reportedTotal = money(amounts[0]); awaitingTotal = false; }
        continue;
      }
      const count = cells.find(cell => /^\d+$/.test(cell));
      if (count) quantity = Number(count);
      for (const cell of cells) {
        if (isProduct(cell)) description = cell;
        else if (description && /^(?:\(Elite\)|New Line|Upgrade|BYOD|Wireless New Line|Wireless Upgrade|Bonus -|for \d)/i.test(cell)) description += ` ${cell}`;
      }
      if (!amounts.length) continue;
      const generated = money(amounts[0]);
      const missingDescription = !description;
      const label = description || 'Unclassified payout — clipped description';
      const ec = /\bEC\b|enhanced commission/i.test(label);
      const bonus = /bonus/i.test(label) && !ec;
      rows.push({
        externalRepId, reportName, generated,
        commissionToIcd: bonus || ec ? 0 : generated,
        ecBonusToIcd: ec ? generated : 0, adjustmentToIcd: 0, bonusesToIcd: bonus ? generated : 0,
        tier: label, orderType: /New Line/i.test(label) ? 'New Line' : /Upgrade/i.test(label) ? 'Upgrade' : /BYOD/i.test(label) ? 'BYOD' : undefined,
        raw: { description: label, quantity: quantity ? String(quantity) : '', amount: amounts[0], report: 'DD BY REP', ...(missingDescription ? { needsReview: 'Missing product description' } : {}) },
      });
      if (missingDescription) warnings.push(`Carrier ${externalRepId}: ${amounts[0]} has a clipped product description; do not infer its plan or bonus.`);
      description = ''; quantity = 0;
    }
    const sum = rows.slice(firstRow).reduce((total, row) => total + row.generated, 0);
    if (reportedTotal === undefined) {
      warnings.push(`Carrier ${externalRepId}: rep total is missing. The export may be incomplete.`);
      rows.slice(firstRow).forEach(row => { row.raw.needsReview = row.raw.needsReview || 'Missing printed rep total'; });
    }
    else if (Math.abs(sum - reportedTotal) > 0.01) throw new Error(`Carrier ${externalRepId}: parsed total ${sum.toFixed(2)} differs from printed total ${reportedTotal.toFixed(2)}. Re-export the full report.`);
  }
  if (!rows.length) throw new Error('No rep totals could be read from this DD BY REP export.');
  if (/Background Check Fee/i.test(sourceText)) {
    warnings.push('Office-only background-check fees are present and are not allocated to reps. Reconcile office totals before confirming.');
    rows.forEach(row => { row.raw.needsReview = row.raw.needsReview || 'Unreconciled office-only adjustment'; });
  }
  return { reportType: 'DD_BY_REP', ...tableauWeeks(sourceText), rows, warnings };
}

function normalizeTableauDetail(grid: string[][], sourceText: string): Omit<DDParsedReport, 'hash'> {
  const headerIndex = grid.findIndex(row => row.some(cell => /^ID$/i.test(clean(cell))) && row.some(cell => /^Name$/i.test(clean(cell))));
  const firstData = grid.slice(headerIndex + 1).find(row => row.some(cell => /^\d{4,6}$/.test(clean(cell))) && row.some(cell => /Smart Circle/i.test(cell)));
  const idCell = firstData?.find(cell => /^\d{4,6}$/.test(clean(cell)));
  const idIndex = idCell && firstData ? firstData.indexOf(idCell) : -1;
  let reportName = idIndex >= 0 && firstData ? clean(firstData[idIndex + 1]) : '';
  const flattened = grid.slice(headerIndex + 1).map(row => row.map(clean).filter(Boolean));
  if (reportName && !reportName.includes(' ')) {
    // Tableau wraps the lead rep's name across rows: the first name sits on the
    // data row and the surname on a continuation row BELOW it. Search after the
    // data row (not from the top, which re-finds the first name) and skip
    // layout words so "Benjamin" + "Tinoco" resolves instead of "Benjamin Benjamin".
    const dataRowIndex = idCell ? flattened.findIndex(row => row.includes(clean(idCell))) : -1;
    const surname = flattened.slice(dataRowIndex + 1, dataRowIndex + 6).flat().find(cell =>
      /^[A-Z][A-Za-z'’-]+$/.test(cell) && cell !== reportName && !/^(Wireless|Base|Campaign|Type|Completed|AIR|Costco|Target)$/i.test(cell));
    if (surname) reportName = `${reportName} ${surname}`;
  }
  const externalRepId = clean(idCell);
  if (!externalRepId || !reportName) throw new Error('The lead rep identity could not be read from this DD DETAIL export.');
  const lookupIndexes = flattened.map((row, index) => row.some(cell => /^SPE-\d+$/i.test(cell)) ? index : -1).filter(index => index >= 0);
  const rows = lookupIndexes.map((start, index): DDNormalizedRow => {
    const segment = flattened.slice(start, lookupIndexes[index + 1] ?? flattened.length).flat();
    const description = segment.filter(cell => /Next Up|Wireless Bon|Device Bonus|AT&T Unlimit|AIR|New Line|Upgrade|BYOD/i.test(cell)).join(' · ');
    return {
      externalRepId, reportName, generated: 0, commissionToIcd: 0, ecBonusToIcd: 0, adjustmentToIcd: 0, bonusesToIcd: 0,
      noEcBonusReason: segment.find(cell => /no ec|ineligible|missing|withheld/i.test(cell)),
      tier: segment.find(cell => /Base|Campaign|Add On/i.test(cell)), retail: segment.find(cell => /Costco|Target|BJS/i.test(cell)),
      orderType: segment.find(cell => /^(New Line|Upgrade|BYOD)$/i.test(cell)),
      raw: { productionLookup: segment.find(cell => /^SPE-\d+$/i.test(cell)) ?? '', description, report: 'DD DETAIL' },
    };
  });
  if (!rows.length) throw new Error('No production detail rows could be read from this DD DETAIL export.');
  const weeks = tableauWeeks(sourceText);
  return { reportType: 'DD_DETAIL', ...weeks, rows, warnings: ['DD DETAIL contains production attributes but no reliable per-row amount in this export; office dollars are reconciled from DD BY REP.'] };
}

export function normalizeGrid(grid: string[][], sourceText: string): Omit<DDParsedReport, 'hash'> {
  if (/DD\s*BY\s*REP/i.test(sourceText) && grid.some(row => row.some(cell => /Smart Circle/i.test(cell)))) return normalizeTableauByRep(grid, sourceText);
  if (/DD\s*DETAIL/i.test(sourceText) && grid.some(row => row.some(cell => /cl\.Production/i.test(cell)))) return normalizeTableauDetail(grid, sourceText);
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
  // Serverless bundles only trace literal import specifiers. pdfjs loads its
  // worker through a computed dynamic import, which is invisible to the
  // tracer — so import it here with a literal path and hand it to pdfjs via
  // the global it checks before attempting its own (untraceable) import.
  const pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;
  // pdfjs TRANSFERS the buffer it is given, detaching the caller's copy —
  // anything hashed or re-read after this call would silently see an empty
  // array (every report then shares the empty-input SHA-256 and collides as
  // "already confirmed"). Hand pdfjs its own copy so the caller's bytes survive.
  const document = await pdfjs.getDocument({ data: bytes.slice() }).promise;
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
