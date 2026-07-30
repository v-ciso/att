import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { audit, clientIp } from '@/lib/audit';
import {
  checkLoginThrottle,
  clearLoginFailures,
  normaliseEmail,
  pruneLoginAttempts,
  recordLoginAttempt,
} from '@/lib/rate-limit';
import { verifySupabasePassword } from '@/lib/supabase-admin';
import { isSuperAdminEmail } from '@/lib/super-admins';
import { authSecret } from '@/lib/auth-secret';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // An 8-hour ceiling covers a full field shift, so a rep on a route is not
  // bounced to the login screen mid-visit, while still ending the session the
  // same day rather than leaving a 30-day token (NextAuth's default) alive on a
  // phone that gets lost or handed over. updateAge keeps the token from being
  // rewritten on every single request.
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60, updateAge: 30 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // Address and client of the caller, for throttling and the audit rows.
        // clientIp handles NextAuth's plain-object headers as well as a real
        // Headers instance, so both paths record the same thing.
        const ip = clientIp(req as unknown as Request);
        const hdrs = (req as { headers?: Record<string, string> } | undefined)?.headers;
        const userAgent = hdrs?.['user-agent'] ?? null;

        // Refuse before touching the password when this email or address has
        // already burned through its budget. Checked first so a locked-out
        // attacker cannot keep using us as a password oracle.
        const verdict = await checkLoginThrottle(credentials.email, ip);
        if (!verdict.allowed) {
          await audit({
            action: 'auth.locked_out',
            actor: { email: normaliseEmail(credentials.email), role: 'UNKNOWN' },
            meta: { reason: verdict.reason, retryAfterMinutes: verdict.retryAfterMinutes },
            ip,
            userAgent,
          });
          return null;
        }

        // Emails are stored lowercased; normalise the lookup so a rep typing
        // their address with a capital letter is not told their password is
        // wrong.
        const user = await prisma.user.findUnique({
          where: { email: normaliseEmail(credentials.email) },
          include: { marketOwner: true },
        });
        if (!user) {
          await recordLoginAttempt(credentials.email, ip, false);
          return null;
        }

        // A suspended user, or a user under a suspended company, cannot sign in
        // — even with the right password. The row survives so history is kept.
        if (user.disabled || user.marketOwner?.disabled) {
          await recordLoginAttempt(credentials.email, ip, false);
          await audit({
            action: 'auth.login_failed',
            actor: {
              id: user.id,
              email: user.email,
              role: user.role,
              marketOwnerId: user.marketOwnerId,
            },
            meta: { reason: user.disabled ? 'user_disabled' : 'company_disabled' },
            ip,
            userAgent,
          });
          return null;
        }

        // Dual path. Accounts provisioned through the admin console live in
        // Supabase Auth (authId set) and are verified there — that is what makes
        // them manageable from the Supabase console (OAuth, MFA, resets).
        // Older accounts (like the founder's) keep their bcrypt hash, so nothing
        // about the existing login changes and there is no risky cutover.
        let ok = false;
        if (user.authId) {
          const authId = await verifySupabasePassword(credentials.email, credentials.password);
          ok = authId === user.authId;
        } else if (user.passwordHash) {
          ok = await bcrypt.compare(credentials.password, user.passwordHash);
        }
        if (!ok) {
          await recordLoginAttempt(credentials.email, ip, false);
          await audit({
            action: 'auth.login_failed',
            actor: {
              id: user.id,
              email: user.email,
              role: user.role,
              marketOwnerId: user.marketOwnerId,
            },
            meta: { reason: 'bad_password' },
            ip,
            userAgent,
          });
          return null;
        }

        // Genuine sign-in: wipe the strikes so an earlier fumble does not
        // follow them around, and opportunistically prune the old rows.
        await recordLoginAttempt(credentials.email, ip, true);
        await clearLoginFailures(credentials.email);
        void pruneLoginAttempts();
        await audit({
          action: 'auth.login',
          actor: {
            id: user.id,
            email: user.email,
            role: user.role,
            marketOwnerId: user.marketOwnerId,
          },
          meta: { method: user.authId ? 'supabase' : 'bcrypt' },
          ip,
          userAgent,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          marketOwnerId: user.marketOwnerId ?? undefined,
          employeeId: user.employeeId ?? undefined,
          companyName: user.marketOwner?.name ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email; // carry explicitly — the client relies on it
        token.role = user.role;
        token.marketOwnerId = user.marketOwnerId;
        token.employeeId = user.employeeId;
        token.companyName = user.companyName;
        // Compute super-admin HERE (server-side, where SUPER_ADMIN_EMAILS is
        // readable) and stamp it on the token, so the browser never has to
        // re-derive it from an email that may not survive the session round-trip.
        token.isSuperAdmin = isSuperAdminEmail(user.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id,
          email: token.email as string,
          role: token.role,
          marketOwnerId: token.marketOwnerId,
          employeeId: token.employeeId,
          isSuperAdmin: token.isSuperAdmin,
          companyName: token.companyName,
        };
      }
      return session;
    },
  },
  // Shared with middleware.ts via lib/auth-secret.ts so both sides always
  // agree on the signing key.
  secret: authSecret(),
};

export async function auth() {
  return getServerSession(authOptions);
}
