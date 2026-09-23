import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { audit } from '@/lib/audit';
import { z } from 'zod';

const schema = z.object({ batchId: z.string().cuid(), confirmation: z.literal(true) });
type SessionUser = { id: string; email?: string | null; role?: string; marketOwnerId?: string };

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user?.marketOwnerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'OWNER') return NextResponse.json({ error: 'Only the owner can roll back an authoritative week.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid rollback request.' }, { status: 400 });
  const restored = await prisma.$transaction(async tx => {
    const target = await tx.dDImportBatch.findFirst({ where: { id: parsed.data.batchId, marketOwnerId: user.marketOwnerId } });
    if (!target) throw new Error('Batch not found.');
    await tx.dDImportBatch.updateMany({ where: { marketOwnerId: user.marketOwnerId, ddWeek: target.ddWeek, isAuthoritative: true }, data: { isAuthoritative: false, status: 'ROLLED_BACK' } });
    return tx.dDImportBatch.update({ where: { id: target.id }, data: { isAuthoritative: true, status: 'CONFIRMED', confirmedBy: user.id, confirmedAt: new Date() } });
  });
  await audit({ action: 'dd.rollback', actor: { id: user.id, email: user.email ?? 'unknown', role: user.role ?? 'UNKNOWN', marketOwnerId: user.marketOwnerId }, targetType: 'DDImportBatch', targetId: restored.id, meta: { ddWeek: restored.ddWeek.toISOString() } });
  return NextResponse.json({ batch: restored });
}
