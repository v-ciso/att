import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { z } from 'zod';

const rowSchema = z.object({
  externalRepId: z.string().regex(/^\d{4,}$/), reportName: z.string().min(1).max(140), generated: z.number().finite(),
  commissionToIcd: z.number().finite(), ecBonusToIcd: z.number().finite(), adjustmentToIcd: z.number().finite(), bonusesToIcd: z.number().finite(),
  noEcBonusReason: z.string().max(500).optional(), tier: z.string().max(100).optional(), retail: z.string().max(160).optional(), store: z.string().max(160).optional(), orderType: z.string().max(160).optional(), raw: z.record(z.string()),
});
const schema = z.object({
  fileName: z.string().min(1).max(255), hash: z.string().length(64), reportType: z.enum(['DD_BY_REP', 'DD_DETAIL']), processedWeek: z.string().datetime(), ddWeek: z.string().datetime(), warnings: z.array(z.string().max(500)).max(100), rows: z.array(rowSchema).min(1).max(10000), confirmation: z.literal(true),
});
type SessionUser = { id: string; email?: string | null; role?: string; marketOwnerId?: string };

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user?.marketOwnerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes(user.role ?? '')) return NextResponse.json({ error: 'Only owners and managers can confirm replacement.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid confirmation payload.', details: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const ddWeek = new Date(input.ddWeek);
  const processedWeek = new Date(input.processedWeek);
  const company = await prisma.marketOwner.findUnique({ where: { id: user.marketOwnerId }, select: { operatingStartDate: true } });
  if (company?.operatingStartDate && ddWeek < company.operatingStartDate) return NextResponse.json({ error: 'This week predates company operations.' }, { status: 422 });
  const identities = await prisma.repExternalIdentity.findMany({ where: { marketOwnerId: user.marketOwnerId, source: 'ATT_DD', externalRepId: { in: input.rows.map(row => row.externalRepId) } } });
  const byId = new Map(identities.map(identity => [identity.externalRepId, identity.repProfileId]));
  const unknown = [...new Set(input.rows.map(row => row.externalRepId).filter(id => !byId.has(id)))];
  if (unknown.length) return NextResponse.json({ error: 'Every carrier ID must be mapped before confirmation.', unknown }, { status: 409 });
  const summaries = new Map<string, { externalRepId: string; reportName: string; generated: number; ecBonusReceived: number; ecBonusMissing: number; detailCount: number; tier?: string }>();
  for (const row of input.rows) {
    const current = summaries.get(row.externalRepId) ?? { externalRepId: row.externalRepId, reportName: row.reportName, generated: 0, ecBonusReceived: 0, ecBonusMissing: 0, detailCount: 0, tier: row.tier };
    current.generated += row.generated; current.ecBonusReceived += row.ecBonusToIcd; current.detailCount += 1;
    if (row.noEcBonusReason && row.ecBonusToIcd === 0 && row.adjustmentToIcd < 0) current.ecBonusMissing += Math.abs(row.adjustmentToIcd);
    summaries.set(row.externalRepId, current);
  }
  try {
    const batch = await prisma.$transaction(async tx => {
      const existingHash = await tx.dDImportBatch.findUnique({ where: { marketOwnerId_sourceHash: { marketOwnerId: user.marketOwnerId!, sourceHash: input.hash } } });
      if (existingHash) return existingHash;
      const previous = await tx.dDImportBatch.findFirst({ where: { marketOwnerId: user.marketOwnerId, ddWeek, reportType: input.reportType, isAuthoritative: true }, orderBy: { confirmedAt: 'desc' } });
      if (previous) await tx.dDImportBatch.update({ where: { id: previous.id }, data: { isAuthoritative: false, status: 'SUPERSEDED' } });
      return tx.dDImportBatch.create({
        data: {
          marketOwnerId: user.marketOwnerId!, sourceFileName: input.fileName, sourceHash: input.hash, reportType: input.reportType, processedWeek, ddWeek,
          status: 'CONFIRMED', isAuthoritative: true, supersedesId: previous?.id, uploadedBy: user.id, confirmedBy: user.id, confirmedAt: new Date(), warnings: input.warnings,
          officeGenerated: [...summaries.values()].reduce((sum, row) => sum + row.generated, 0), ecBonusReceived: [...summaries.values()].reduce((sum, row) => sum + row.ecBonusReceived, 0), ecBonusMissing: [...summaries.values()].reduce((sum, row) => sum + row.ecBonusMissing, 0), rowCount: input.rows.length,
          summaries: { create: [...summaries.values()].map(summary => ({ ...summary, repProfileId: byId.get(summary.externalRepId)! })) },
          detailRows: { create: input.rows.map(row => ({ externalRepId: row.externalRepId, reportName: row.reportName, generated: row.generated, commissionToIcd: row.commissionToIcd, ecBonusToIcd: row.ecBonusToIcd, adjustmentToIcd: row.adjustmentToIcd, bonusesToIcd: row.bonusesToIcd, noEcBonusReason: row.noEcBonusReason, tier: row.tier, retail: row.retail, store: row.store, orderType: row.orderType, rowData: row.raw })) },
        }, include: { summaries: { include: { repProfile: true } } },
      });
    });
    await audit({ action: 'dd.week_replaced', actor: { id: user.id, email: user.email ?? 'unknown', role: user.role ?? 'UNKNOWN', marketOwnerId: user.marketOwnerId }, targetType: 'DDImportBatch', targetId: batch.id, meta: { ddWeek: input.ddWeek, rows: input.rows.length, total: [...summaries.values()].reduce((sum, row) => sum + row.generated, 0) } });
    return NextResponse.json({ batch });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return NextResponse.json({ error: 'This exact report was already confirmed.' }, { status: 409 });
    throw error;
  }
}
