import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin';
import { addCompanyUser, removeCompanyUser, resetUserPassword } from '@/lib/provision';
import type { Role } from '@prisma/client';

export async function POST(request: NextRequest) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    const result = await addCompanyUser({
      marketOwnerId: body.marketOwnerId,
      email: body.email,
      name: body.name,
      role: (body.role ?? 'MANAGER') as Role,
      password: body.password,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to add user' }, { status: 400 });
  }
}

// Reset a user's password (manage an owner/manager). Returns the new one once.
export async function PATCH(request: NextRequest) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { userId, password } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    const result = await resetUserPassword(userId, password);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to reset password' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    const result = await removeCompanyUser(userId);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to remove user' }, { status: 400 });
  }
}
