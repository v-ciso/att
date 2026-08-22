import assert from 'node:assert/strict';
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
  console.log('dd-reports: PDF extraction and normalization passed');
}

void main();
