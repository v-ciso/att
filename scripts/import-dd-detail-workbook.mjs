import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { PrismaClient } from '@prisma/client';
import readXlsxFile from 'read-excel-file/node';

const [file, marketOwnerId, mode = '--dry-run'] = process.argv.slice(2);
assert(file && marketOwnerId && ['--dry-run', '--confirm'].includes(mode), 'Provide workbook, tenant ID, and --dry-run or --confirm.');
const prisma = new PrismaClient();
const cents = value => {
  assert(typeof value === 'number' && Number.isFinite(value), 'Missing or invalid financial cell.');
  return Math.round(value * 100);
};
const text = value => value instanceof Date ? value.toISOString() : String(value ?? '').trim();

try {
  const bytes = await readFile(file);
  assert(bytes.length <= 12 * 1024 * 1024, 'Workbook exceeds the upload limit.');
  const sourceHash = createHash('sha256').update(bytes).digest('hex');
  const grid = await readXlsxFile(bytes);
  const headers = grid[0].map(text);
  assert(new Set(headers).size === headers.length, 'Duplicate column names.');
  const column = name => {
    const index = headers.indexOf(name);
    assert(index >= 0, `Missing column: ${name}`);
    return index;
  };
  const cell = (row, name) => row[column(name)];
  const financial = ['Commission Base to ICD', 'EC Bonus to ICD', 'Adjustments to ICD', 'Bonuses to ICD', 'Total $ to ICD'];
  const totalRow = grid[1];
  assert.equal(text(totalRow[0]), 'Grand Total to ICD');
  const sourceRows = grid.slice(2).filter(row => row.some(value => value !== null && value !== ''));
  assert(sourceRows.length > 0 && sourceRows.length <= 10000, 'Invalid detail row count.');
  const weeks = [...new Set(sourceRows.map(row => text(cell(row, 'cl.DD Week'))).filter(Boolean))];
  assert.equal(weeks.length, 1, 'Expected exactly one DD week.');
  const match = weeks[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  assert(match, 'DD week must be an explicit calendar date.');
  const iso = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  const ddWeek = new Date(`${iso}T00:00:00.000Z`);
  assert.equal(ddWeek.toISOString().slice(0, 10), iso, 'Invalid DD week.');
  const totals = financial.map(name => sourceRows.reduce((sum, row) => sum + cents(cell(row, name)), 0));
  financial.forEach((name, i) => assert.equal(totals[i], cents(cell(totalRow, name)), `${name} does not reconcile.`));
  const uniqueKeys = sourceRows.map(row => text(cell(row, 'cl.Unique Key')));
  assert(uniqueKeys.every(Boolean) && new Set(uniqueKeys).size === uniqueKeys.length, 'Missing or duplicate transaction keys.');
  const rows = sourceRows.map((row, index) => {
    const identity = text(cell(row, 'cl.ICD Rep Name')).match(/^(.+?)\s*\((\d{4,})\)$/);
    assert(identity, `Missing carrier identity on row ${index + 3}.`);
    const amounts = financial.map(name => cents(cell(row, name)));
    assert.equal(amounts.slice(0, 4).reduce((sum, amount) => sum + amount, 0), amounts[4], `Row ${index + 3} does not reconcile.`);
    const raw = Object.fromEntries(headers.map((header, i) => [header, text(row[i])]));
    return {
      externalRepId: identity[2], reportName: identity[1].trim(),
      commissionToIcd: amounts[0] / 100, ecBonusToIcd: amounts[1] / 100,
      adjustmentToIcd: amounts[2] / 100, bonusesToIcd: amounts[3] / 100, generated: amounts[4] / 100,
      noEcBonusReason: text(cell(row, 'No EC Bonus Reason')) || null,
      tier: text(cell(row, 'cl.Tier')) || text(cell(row, 'cl.Commission Type')) || null,
      retail: text(cell(row, 'cl.Retail')) || null, store: text(cell(row, 'cl.Store')) || null,
      orderType: text(cell(row, 'cl.Order Type')) || text(cell(row, 'cl.Product')) || null,
      rowData: { ...raw, sourceRow: String(index + 3), productionLookup: text(cell(row, 'cl.Production Lookup')), description: ['cl.Product', 'cl.Description', 'cl.Description Detail'].map(name => text(cell(row, name))).filter(Boolean).join(' · '), report: 'DD DETAIL' },
    };
  });
  const company = await prisma.marketOwner.findUniqueOrThrow({ where: { id: marketOwnerId }, select: { name: true, operatingStartDate: true } });
  const corporations = [...new Set(sourceRows.map(row => text(cell(row, 'ICD.Corporation Name'))).filter(Boolean))];
  assert(corporations.length === 1 && corporations[0].toLowerCase().startsWith(company.name.toLowerCase()), 'Workbook corporation does not match tenant.');
  assert(!company.operatingStartDate || ddWeek >= company.operatingStartDate, 'Report predates company operations.');
  const existingReport = await prisma.dDImportBatch.findFirst({ where: { marketOwnerId, ddWeek, reportType: 'DD_BY_REP' }, orderBy: { createdAt: 'desc' }, select: { processedWeek: true } });
  assert(existingReport, 'A matching DD-by-rep week is required to establish processed week.');
  const identities = await prisma.repExternalIdentity.findMany({ where: { marketOwnerId, source: 'ATT_DD', externalRepId: { in: [...new Set(rows.map(row => row.externalRepId))] } }, select: { externalRepId: true, repProfileId: true } });
  const profiles = new Map(identities.map(identity => [identity.externalRepId, identity.repProfileId]));
  const summaries = new Map();
  for (const row of rows) {
    assert(profiles.has(row.externalRepId), `Unmapped carrier ID: ${row.externalRepId}`);
    const summary = summaries.get(row.externalRepId) ?? { externalRepId: row.externalRepId, reportName: row.reportName, repProfileId: profiles.get(row.externalRepId), generated: 0, ecBonusReceived: 0, ecBonusMissing: 0, detailCount: 0 };
    summary.generated += row.generated;
    summary.ecBonusReceived += row.ecBonusToIcd;
    summary.detailCount++;
    if (row.noEcBonusReason && row.noEcBonusReason !== 'No Loss' && row.ecBonusToIcd === 0 && row.adjustmentToIcd < 0) summary.ecBonusMissing += Math.abs(row.adjustmentToIcd);
    summaries.set(row.externalRepId, summary);
  }
  const expected = { company: company.name, ddWeek: iso, rows: rows.length, reps: summaries.size, total: totals[4] / 100, ecBonus: totals[1] / 100 };
  console.log(JSON.stringify({ mode, ...expected, summaries: [...summaries.values()].map(({ repProfileId, ...summary }) => summary) }, null, 2));
  if (mode === '--confirm') {
    const batch = await prisma.$transaction(async tx => {
      const duplicate = await tx.dDImportBatch.findUnique({ where: { marketOwnerId_sourceHash: { marketOwnerId, sourceHash } } });
      if (duplicate) {
        assert(duplicate.status === 'CONFIRMED' && duplicate.isAuthoritative && duplicate.reportType === 'DD_DETAIL', 'Existing hash belongs to a different or inactive import.');
        return duplicate;
      }
      const prior = await tx.dDImportBatch.findFirst({ where: { marketOwnerId, ddWeek, reportType: 'DD_DETAIL', isAuthoritative: true }, select: { id: true } });
      assert(!prior, 'An authoritative detail report already exists; refusing to overwrite it.');
      const id = randomUUID();
      const created = await tx.dDImportBatch.create({ data: {
        id, marketOwnerId, source: 'XLSX_UPLOAD', sourceFileName: basename(file), sourceHash,
        reportType: 'DD_DETAIL', processedWeek: existingReport.processedWeek, ddWeek, status: 'CONFIRMED', isAuthoritative: true,
        uploadedBy: 'system:approved-chat-import', confirmedBy: 'system:approved-chat-import', confirmedAt: new Date(),
        officeGenerated: expected.total, ecBonusReceived: expected.ecBonus,
        ecBonusMissing: [...summaries.values()].reduce((sum, summary) => sum + summary.ecBonusMissing, 0), rowCount: rows.length,
        warnings: ['Processed week matched to the existing DD-by-rep report. Detail totals are independent of the partial DD-by-rep export; that export was not replaced.'],
      } });
      await tx.dDRepSummary.createMany({ data: [...summaries.values()].map(summary => ({ ...summary, batchId: id })) });
      await tx.dDDetailRow.createMany({ data: rows.map((row, i) => ({ ...row, id: `${id}-${String(i + 1).padStart(5, '0')}`, batchId: id })) });
      await tx.auditLog.create({ data: { actorEmail: 'system:approved-chat-import', actorRole: 'SYSTEM', marketOwnerId, action: 'dd.detail_imported', targetType: 'DDImportBatch', targetId: id, meta: { ...expected, sourceHash, sourceFileName: basename(file), authorizedVia: 'user-requested chat import', preservedOtherReports: true } } });
      return created;
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 60000 });
    const saved = await prisma.dDImportBatch.findFirstOrThrow({ where: { id: batch.id, marketOwnerId }, select: { id: true, status: true, rowCount: true, officeGenerated: true, ecBonusReceived: true, _count: { select: { detailRows: true, summaries: true } }, detailRows: { select: { generated: true, ecBonusToIcd: true } } } });
    assert.equal(saved._count.detailRows, expected.rows);
    assert.equal(saved._count.summaries, expected.reps);
    assert.equal(saved.officeGenerated, expected.total);
    assert.equal(saved.ecBonusReceived, expected.ecBonus);
    assert.equal(saved.detailRows.reduce((sum, row) => sum + cents(row.generated), 0), totals[4]);
    assert.equal(saved.detailRows.reduce((sum, row) => sum + cents(row.ecBonusToIcd), 0), totals[1]);
    console.log(JSON.stringify({ verified: true, batchId: saved.id, status: saved.status, ...expected }));
  }
} finally {
  await prisma.$disconnect();
}
