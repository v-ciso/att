import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

type SessionUser = { role?: string; marketOwnerId?: string };
const patchSchema = z.object({ displayName: z.string().trim().min(2).max(140).optional(), email: z.string().email().nullable().optional(), phone: z.string().max(40).nullable().optional(), teamName: z.string().max(140).nullable().optional(), storeName: z.string().max(140).nullable().optional(), status: z.enum(['active', 'retired']).optional(), startDate: z.string().date().nullable().optional() });
async function context() { const session = await getServerSession(authOptions); return session?.user as SessionUser | undefined; }

export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const user = await context();
  if (!user?.marketOwnerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { code } = await params;
  const profile = await prisma.repProfile.findFirst({
    where: { marketOwnerId: user.marketOwnerId, employeeCode: decodeURIComponent(code) },
    include: { externalIds: true, ddSummaries: { where: { batch: { isAuthoritative: true } }, include: { batch: { select: { ddWeek: true, reportType: true } } }, orderBy: { batch: { ddWeek: 'desc' } }, take: 52 } },
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  return NextResponse.json({ profile }, { headers: { 'Cache-Control': 'no-store, private' } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const user = await context();
  if (!user?.marketOwnerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['OWNER', 'MANAGER'].includes(user.role ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile update.' }, { status: 400 });
  const { code } = await params;
  const current = await prisma.repProfile.findFirst({ where: { marketOwnerId: user.marketOwnerId, employeeCode: decodeURIComponent(code) } });
  if (!current) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  const profile = await prisma.repProfile.update({ where: { id: current.id }, data: { ...parsed.data, startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : parsed.data.startDate } });
  return NextResponse.json({ profile });
}
