/**
 * Generates a small but STRUCTURALLY VALID multi-page PDF (with a real xref
 * table and trailer) for verifying the document viewer. Hand-rolled PDFs that
 * skip the xref often still open in lenient viewers, which makes them useless
 * as a test fixture: they prove nothing about whether pdf.js can actually
 * paginate a real file.
 *
 * Usage: npx tsx scripts/make-test-pdf.ts [outPath] [pageCount]
 */
import { writeFileSync } from 'node:fs';

function buildPdf(pageTitles: string[]): Buffer {
  const objects: string[] = [];

  // 1 = Catalog, 2 = Pages, 3 = Font, then per page: content stream + page.
  const pageObjNums: number[] = [];
  let next = 4;
  const pageBodies: string[] = [];

  for (const title of pageTitles) {
    const contentNum = next++;
    const pageNum = next++;
    pageObjNums.push(pageNum);
    const text = `BT /F1 18 Tf 40 200 Td (${title.replace(/[()\\]/g, '')}) Tj ET`;
    pageBodies.push(
      `${contentNum} 0 obj\n<< /Length ${text.length} >>\nstream\n${text}\nendstream\nendobj\n`
    );
    pageBodies.push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 260] ` +
        `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`
    );
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjNums.map(n => `${n} 0 R`).join(' ')}] ` +
      `/Count ${pageObjNums.length} >>\nendobj\n`
  );
  objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  objects.push(...pageBodies);

  // Assemble, tracking byte offsets for the xref table.
  const header = '%PDF-1.4\n';
  let body = '';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(header.length + body.length);
    body += obj;
  }

  const xrefStart = header.length + body.length;
  const count = objects.length + 1; // +1 for the free object 0
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, 'latin1');
}

const out = process.argv[2] ?? '/tmp/promo-test.pdf';
const pages = Math.max(1, Number(process.argv[3] ?? 3));
const titles = Array.from({ length: pages }, (_, i) => `PROMO SHEET - PAGE ${i + 1} OF ${pages}`);
const pdf = buildPdf(titles);
writeFileSync(out, pdf);
console.log(`wrote ${out} (${pdf.length} bytes, ${pages} pages)`);
