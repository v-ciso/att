import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isSuperAdminEmail } from '@/lib/super-admins';

export { isSuperAdminEmail };

// Who may reach the vendor admin console (create/disable companies, manage
// users across ALL tenants). This is KGV Inc staff, not a customer. The email
// list lives in lib/super-admins.ts so the client sidebar can use it too.

/** Returns the session email if the caller is a super-admin, else null. */
export async function requireSuperAdmin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  return isSuperAdminEmail(email) ? email! : null;
}
