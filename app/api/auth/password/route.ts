import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Lets a customer replace the password they were handed at onboarding, so the
// vendor stops being able to sign in as them. Always requires the CURRENT
// password: a hijacked session must not be enough to lock the real owner out.
const schema = z.object({
  currentPassword: z.string().min(1),
  // bcrypt silently truncates past 72 bytes; reject rather than quietly
  // storing something shorter than the user believes they set.
  newPassword: z.string().min(12).max(72),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

    const { currentPassword, newPassword } = schema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return NextResponse.json({ error: 'New password must be different' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'New password must be at least 12 characters.' },
        { status: 400 }
      );
    }
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Could not change password' }, { status: 500 });
  }
}
