import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { z } from 'zod';

const schema = z.object({
  externalRepId: z.string().regex(/^\d{4,}$/),
  reportName: z.string().trim().min(2).max(140),
  profileId: z.string().cuid().optional(),
  displayName: z.string().trim().min(2).max(140).optional(),
});

type SessionUser = { id: string; email?: string | null; role?: string; marketOwnerId?: string };

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user?.marketOwnerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const marketOwnerId = user.marketOwnerId;
  if (!['OWNER', 'MANAGER'].includes(user.role ?? '')) return NextResponse.json({ error: 'Only owners and managers can map report identities.' }, { status: 403 });
  const result = schema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: 'Invalid profile mapping.', details: result.error.flatten() }, { status: 400 });
  const input = result.data;
  const profile = await prisma.$transaction(async tx => {
    let target = input.profileId
      ? await tx.repProfile.findFirst({ where: { id: input.profileId, marketOwnerId } })
      : null;
    if (input.profileId && !target) throw new Error('Profile not found in this company.');
    if (!target) {
      const code = `REP-${input.externalRepId}`;
      target = await tx.repProfile.upsert({
        where: { marketOwnerId_employeeCode: { marketOwnerId, employeeCode: code } },
        create: { marketOwnerId, employeeCode: code, displayName: input.displayName ?? input.reportName, legalName: input.reportName },
        update: {},
      });
    }
    await tx.repExternalIdentity.upsert({
      where: { marketOwnerId_source_externalRepId: { marketOwnerId, source: 'ATT_DD', externalRepId: input.externalRepId } },
      create: { marketOwnerId, source: 'ATT_DD', externalRepId: input.externalRepId, reportName: input.reportName, repProfileId: target.id },
      update: { reportName: input.reportName, repProfileId: target.id },
    });
    return target;
  });
  await audit({ action: 'dd.identity_mapped', actor: { id: user.id, email: user.email ?? 'unknown', role: user.role ?? 'UNKNOWN', marketOwnerId }, targetType: 'RepProfile', targetId: profile.id, meta: { externalRepId: input.externalRepId, reportName: input.reportName } });
  return NextResponse.json({ profile });
}
