import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { can } from '@/lib/permissions';
import { audit, clientIp } from '@/lib/audit';
import { extractPdfGrid, MAX_REPORT_BYTES, normalizeGrid, parseDelimitedReport, reportHash, summarizeRows } from '@/lib/dd-reports';

export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store, private' } as const;
type SessionUser = { id: string; email?: string | null; role?: string; marketOwnerId?: string; isSuperAdmin?: boolean };

async function actor(): Promise<(SessionUser & { marketOwnerId: string }) | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  return user?.marketOwnerId ? { ...user, marketOwnerId: user.marketOwnerId } : null;
}

interface RosterPerson { name: string; employeeCode: string; role?: string; team?: string }

/** The live roster lives in TenantData as the same JSON the tracker uses. */
async function loadRoster(marketOwnerId: string): Promise<RosterPerson[]> {
  const row = await prisma.tenantData.findUnique({ where: { marketOwnerId_key: { marketOwnerId, key: 'se-people-v1' } } });
  if (!Array.isArray(row?.value)) return [];
  return (row.value as Array<Record<string, unknown>>)
    .filter(person => typeof person?.name === 'string' && typeof person?.employeeCode === 'string')
    .map(person => ({ name: person.name as string, employeeCode: person.employeeCode as string, role: person.role as string | undefined, team: person.team as string | undefined }));
}

const nameKey = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const [batches, profiles, company, productionBatch, roster] = await Promise.all([
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
    prisma.dDImportBatch.findFirst({
      where: { marketOwnerId: user.marketOwnerId, reportType: 'DD_DETAIL', isAuthoritative: true },
      orderBy: { confirmedAt: 'desc' },
      select: {
        id: true,
        ddWeek: true,
        detailRows: {
          select: { id: true, externalRepId: true, reportName: true, tier: true, retail: true, store: true, orderType: true, noEcBonusReason: true, rowData: true },
          orderBy: { id: 'asc' },
          take: 500,
        },
      },
    }),
    loadRoster(user.marketOwnerId),
  ]);
  return NextResponse.json({ batches, profiles, productionBatch, roster, operatingStartDate: company?.operatingStartDate }, { headers: NO_STORE });
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
    let summaries = summarizeRows(parsed.rows).map(summary => ({ ...summary, profile: byId.get(summary.externalRepId)?.repProfile ?? null }));

    // Auto-match: a carrier name that exactly matches a roster member or an
    // existing profile (case/punctuation-insensitive) maps itself, so known
    // reps never need manual resolution — only genuinely new people prompt.
    const unmatched = summaries.filter(summary => !summary.profile);
    if (unmatched.length) {
      const [roster, existingProfiles] = await Promise.all([
        loadRoster(user.marketOwnerId),
        prisma.repProfile.findMany({ where: { marketOwnerId: user.marketOwnerId } }),
      ]);
      const profilesByName = new Map(existingProfiles.map(profile => [nameKey(profile.displayName), profile]));
      const rosterByName = new Map(roster.map(person => [nameKey(person.name), person]));
      summaries = await Promise.all(summaries.map(async summary => {
        if (summary.profile) return summary;
        const key = nameKey(summary.reportName);
        let target = profilesByName.get(key) ?? null;
        if (!target) {
          const person = rosterByName.get(key);
          if (person) {
            target = await prisma.repProfile.upsert({
              where: { marketOwnerId_employeeCode: { marketOwnerId: user.marketOwnerId, employeeCode: person.employeeCode } },
              create: { marketOwnerId: user.marketOwnerId, employeeCode: person.employeeCode, displayName: person.name, teamName: person.team || null },
              update: { displayName: person.name },
            });
          }
        }
        if (!target) return summary;
        await prisma.repExternalIdentity.upsert({
          where: { marketOwnerId_source_externalRepId: { marketOwnerId: user.marketOwnerId, source: 'ATT_DD', externalRepId: summary.externalRepId } },
          create: { marketOwnerId: user.marketOwnerId, source: 'ATT_DD', externalRepId: summary.externalRepId, reportName: summary.reportName, repProfileId: target.id },
          update: { reportName: summary.reportName, repProfileId: target.id },
        });
        return { ...summary, profile: target };
      }));
    }
    return NextResponse.json({ preview: { ...parsed, hash, fileName: name, summaries, totals: { officeGenerated: summaries.reduce((sum, row) => sum + row.generated, 0), ecBonusReceived: summaries.reduce((sum, row) => sum + row.ecBonusReceived, 0), ecBonusMissing: summaries.reduce((sum, row) => sum + row.ecBonusMissing, 0), rows: parsed.rows.length, reps: summaries.length, unmapped: summaries.filter(row => !row.profile).length } } }, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The report could not be parsed.';
    await audit({ action: 'dd.upload_failed', actor: { id: user.id, email: user.email ?? 'unknown', role: user.role ?? 'UNKNOWN', marketOwnerId: user.marketOwnerId }, meta: { message }, ip: clientIp(request) });
    return NextResponse.json({ error: message }, { status: 422, headers: NO_STORE });
  }
}
