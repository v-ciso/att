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

  console.log('dd-reports: PDF extraction and normalization passed');
}

void main();
