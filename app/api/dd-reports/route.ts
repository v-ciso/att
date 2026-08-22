import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/permissions';
import { audit, clientIp } from '@/lib/audit';
import { MAX_REPORT_BYTES, normalizeGrid, parseDelimitedReport, reportHash, summarizeRows } from '@/lib/dd-reports';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store, private' } as const;
type SessionUser = { id: string; email?: string | null; role?: string; marketOwnerId?: string; isSuperAdmin?: boolean };

async function actor() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  return user?.marketOwnerId ? user : null;
}

async function extractPdfGrid(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise;
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
  return { grid, text };
}

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const [batches, profiles, company] = await Promise.all([
    prisma.dDImportBatch.findMany({
      where: { marketOwnerId: user.marketOwnerId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { summaries: { include: { repProfile: true }, orderBy: { generated: 'desc' } } },
    }),
    prisma.repProfile.findMany({
      where: { marketOwnerId: user.marketOwnerId },
      include: { externalIds: true },
      orderBy: { displayName: 'asc' },
    }),
    prisma.marketOwner.findUnique({ where: { id: user.marketOwnerId }, select: { operatingStartDate: true } }),
  ]);
  return NextResponse.json({ batches, profiles, operatingStartDate: company?.operatingStartDate }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(user, 'import.use') || !['OWNER', 'MANAGER'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Only owners and managers can upload DD reports.' }, { status: 403, headers: NO_STORE });
  }
  try {
    const form = await request.formData();
    const file = form.get('file');
    const pasted = String(form.get('pasted') ?? '').trim();
    if (!(file instanceof File) && !pasted) return NextResponse.json({ error: 'Choose a report file or paste report rows.' }, { status: 400, headers: NO_STORE });
    const name = file instanceof File ? file.name : 'pasted-report.tsv';
    const bytes = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : new TextEncoder().encode(pasted);
    if (bytes.byteLength > MAX_REPORT_BYTES) return NextResponse.json({ error: 'Report exceeds the 12 MB limit.' }, { status: 413, headers: NO_STORE });
    if (file instanceof File && !/\.(pdf|csv|tsv|txt)$/i.test(name)) return NextResponse.json({ error: 'Upload a text-based PDF, CSV, TSV, or TXT export.' }, { status: 415, headers: NO_STORE });
    const hash = reportHash(bytes);
    const duplicate = await prisma.dDImportBatch.findUnique({ where: { marketOwnerId_sourceHash: { marketOwnerId: user.marketOwnerId, sourceHash: hash } } });
    if (duplicate) return NextResponse.json({ error: 'This exact report was already uploaded.', duplicateBatchId: duplicate.id }, { status: 409, headers: NO_STORE });
    const parsed = /\.pdf$/i.test(name)
      ? await extractPdfGrid(bytes).then(({ grid, text }) => normalizeGrid(grid, text))
      : parseDelimitedReport(new TextDecoder().decode(bytes));
    const company = await prisma.marketOwner.findUnique({ where: { id: user.marketOwnerId }, select: { operatingStartDate: true } });
    if (company?.operatingStartDate && new Date(parsed.ddWeek) < company.operatingStartDate) {
      return NextResponse.json({ error: `DD week is before company operations began on ${company.operatingStartDate.toISOString().slice(0, 10)}.` }, { status: 422, headers: NO_STORE });
    }
    const identities = await prisma.repExternalIdentity.findMany({ where: { marketOwnerId: user.marketOwnerId, source: 'ATT_DD', externalRepId: { in: parsed.rows.map(row => row.externalRepId) } }, include: { repProfile: true } });
    const byId = new Map(identities.map(identity => [identity.externalRepId, identity]));
    const summaries = summarizeRows(parsed.rows).map(summary => ({ ...summary, profile: byId.get(summary.externalRepId)?.repProfile ?? null }));
    return NextResponse.json({ preview: { ...parsed, hash, fileName: name, summaries, totals: { officeGenerated: summaries.reduce((sum, row) => sum + row.generated, 0), ecBonusReceived: summaries.reduce((sum, row) => sum + row.ecBonusReceived, 0), ecBonusMissing: summaries.reduce((sum, row) => sum + row.ecBonusMissing, 0), rows: parsed.rows.length, reps: summaries.length, unmapped: summaries.filter(row => !row.profile).length } } }, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The report could not be parsed.';
    await audit({ action: 'dd.upload_failed', actor: { id: user.id, email: user.email ?? 'unknown', role: user.role ?? 'UNKNOWN', marketOwnerId: user.marketOwnerId }, meta: { message }, ip: clientIp(request) });
    return NextResponse.json({ error: message }, { status: 422, headers: NO_STORE });
  }
}
