import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { jsPDF } from 'jspdf';
import { extractPdfGrid, normalizeGrid, summarizeRows } from './dd-reports';

async function main() {
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  pdf.text('DD BY REP', 40, 40);
  pdf.text('DD Week: 08/16/2026', 40, 58);
  pdf.text('Processed Week: 08/17/2026', 40, 76);

  const headers = ['Rep Name', 'Company ID', 'Commission Paid to ICD', 'EC Bonus to ICD', 'Total Sums'];
  const values = ['Benjamin Tinoco', '9432422', '$1,000.00', '$100.00', '$1,100.00'];
  const columns = [30, 170, 280, 470, 630];
  headers.forEach((header, index) => pdf.text(header, columns[index], 110));
  values.forEach((value, index) => pdf.text(value, columns[index], 130));

  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  const extracted = await extractPdfGrid(bytes);
  const parsed = normalizeGrid(extracted.grid, extracted.text);

  assert.equal(parsed.reportType, 'DD_BY_REP');
  assert.equal(parsed.ddWeek.slice(0, 10), '2026-08-16');
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].externalRepId, '9432422');
  assert.equal(parsed.rows[0].generated, 1100);

  const [summary] = summarizeRows(parsed.rows);
  assert.equal(summary.reportName, 'Benjamin Tinoco');
  assert.equal(summary.generated, 1100);
  assert.equal(summary.ecBonusReceived, 100);

  for (const fixture of ['dd-by-rep-sorami.pdf', 'dd-detail-sorami.pdf']) {
    const fixtureBytes = new Uint8Array(await readFile(new URL(`../test-fixtures/${fixture}`, import.meta.url)));
    const fixtureExtracted = await extractPdfGrid(fixtureBytes);
    const fixtureParsed = normalizeGrid(fixtureExtracted.grid, fixtureExtracted.text);
    assert.equal(fixtureParsed.ddWeek.slice(0, 10), '2026-08-16', `${fixture} DD week`);
    assert.ok(fixtureParsed.rows.every(row => Number.isFinite(row.generated)));
    if (fixture === 'dd-by-rep-sorami.pdf') {
      const summaries = summarizeRows(fixtureParsed.rows);
      assert.equal(summaries.find(row => row.externalRepId === '9432422')?.generated, 1044);
      assert.ok(fixtureParsed.rows.some(row => row.raw.description?.includes('Next Up')));
    } else {
      assert.equal(fixtureParsed.reportType, 'DD_DETAIL');
      assert.ok(fixtureParsed.rows.length >= 10);
      assert.ok(fixtureParsed.rows.some(row => row.raw.description?.includes('Next Up')));
    }
  }

  const wrapped = [
    ['DD BY REP'], ['Processed Week', 'cl.DD Week'], ['09/21/2026', 'All'],
    ['2', '2'], ['Example Company', 'Owner', 'Ben', 'Smart Circle', 'INTERNET - Internet 1000'],
    ['Tinoco', '$728.00', '$728.00'], ['(9432422)'],
    ['Internet Bonus - Converged Internet', '2', '2'], ['Bonus - Internet 1000', '$100.00', '$100.00'],
    ['WIRELESS - AT&T Unlimited Premium', '1', '1'], ['(Elite) - Upgrade', '$15.00', '$15.00'],
    ['1', '1'], ['WIRELESS - Upgrade', '$44.00', '$44.00'],
    ['Rep Total', '$887.00', '$887.00'],
    ['Alex', 'Smart Circle', 'WIRELESS - New Line', '1'], ['Smith'], ['(9431004)'], ['$116.50'], ['Rep Total'], ['$116.50'],
  ];
  const normalized = normalizeGrid(wrapped, wrapped.map(row => row.join('\t')).join('\n'));
  assert.equal(normalized.ddWeek.slice(0, 10), '2026-09-20');
  assert.equal(normalized.rows[0].raw.quantity, '2');
  assert.equal(normalized.rows[1].raw.description, 'Internet Bonus - Converged Internet Bonus - Internet 1000');
  assert.equal(normalized.rows[1].ecBonusToIcd, 0, 'Converged bonus is not EC');
  assert.equal(normalized.rows[1].bonusesToIcd, 100);
  assert.equal(normalized.rows[2].raw.description, 'WIRELESS - AT&T Unlimited Premium (Elite) - Upgrade');
  assert.equal(normalized.rows[4].generated, 116.5, 'A same-line rep total must not swallow the next rep');
  const clipped = wrapped.slice(0, -2).concat([['***CONFIDENTIAL***'], ['$25.00']]);
  const partial = normalizeGrid(clipped, clipped.map(row => row.join('\t')).join('\n'));
  assert.ok(partial.rows.some(row => row.raw.needsReview));
  assert.equal(partial.rows.at(-1)?.orderType, undefined, 'Do not carry the last plan into a clipped row');
  console.log('dd-reports: PDF extraction, wrapped descriptions, totals and bonus classification passed');
}

void main();
