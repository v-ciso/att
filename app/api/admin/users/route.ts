import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin';
import { addCompanyUser, removeCompanyUser, resetUserPassword } from '@/lib/provision';
import { z } from 'zod';
import { blankAsUndefined, fields, parseBody } from '@/lib/api-validation';
import { audit, clientIp } from '@/lib/audit';

/**
 * `role` was previously `(body.role ?? 'MANAGER') as Role` — a cast, which tells
 * the compiler to trust a value that came from the network. Any string reached
 * Prisma, and the enum is the only thing standing between a caller and a seat
 * they should not be able to hand out. Listing the values makes it enforced at
 * runtime rather than merely asserted at compile time.
 */
const addUserSchema = z.object({
  marketOwnerId: fields.id,
  email: fields.email,
  // Both optional downstream: addCompanyUser derives a name from the email and
  // generates a temp password when these are absent, which is the normal path —
  // the console's form submits them blank.
  name: blankAsUndefined(fields.name),
  role: z.enum(['OWNER', 'MANAGER', 'VIEWER', 'ASM', 'LEAD', 'REP', 'INTERN']).default('MANAGER'),
  password: blankAsUndefined(fields.password),
});

const resetPasswordSchema = z.object({
  userId: fields.id,
  // Omitted by the console so the server issues a generated one.
  password: blankAsUndefined(fields.password),
});

const deleteUserSchema = z.object({
  userId: fields.id,
});

export async function POST(request: NextRequest) {
  const adminEmail = await requireSuperAdmin();
  if (!adminEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = await parseBody(request, addUserSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await addCompanyUser(parsed.data);
    await audit({
      action: 'user.created',
      actor: { email: adminEmail, role: 'SUPER_ADMIN', marketOwnerId: parsed.data.marketOwnerId },
      targetType: 'User', targetId: result.userId,
      meta: { email: result.email, role: result.role },
      ip: clientIp(request), userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to add user' }, { status: 400 });
  }
}

// Reset a user's password (manage an owner/manager). Returns the new one once.
export async function PATCH(request: NextRequest) {
  const adminEmail = await requireSuperAdmin();
  if (!adminEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = await parseBody(request, resetPasswordSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { userId, password } = parsed.data;
    const result = await resetUserPassword(userId, password);
    await audit({
      action: 'user.password_reset',
      actor: { email: adminEmail, role: 'SUPER_ADMIN', marketOwnerId: result.marketOwnerId },
      targetType: 'User', targetId: result.userId,
      meta: { email: result.email },
      ip: clientIp(request), userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to reset password' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const adminEmail = await requireSuperAdmin();
  if (!adminEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = await parseBody(request, deleteUserSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await removeCompanyUser(parsed.data.userId);
    await audit({
      action: 'user.removed',
      actor: { email: adminEmail, role: 'SUPER_ADMIN', marketOwnerId: result.marketOwnerId },
      targetType: 'User', targetId: result.userId,
      meta: { email: result.email },
      ip: clientIp(request), userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to remove user' }, { status: 400 });
  }
}
