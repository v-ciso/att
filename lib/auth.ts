import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { verifySupabasePassword } from '@/lib/supabase-admin';
import { isSuperAdminEmail } from '@/lib/super-admins';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { marketOwner: true },
        });
        if (!user) return null;

        // A suspended user, or a user under a suspended company, cannot sign in
        // — even with the right password. The row survives so history is kept.
        if (user.disabled || user.marketOwner?.disabled) return null;

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
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          marketOwnerId: user.marketOwnerId ?? undefined,
          employeeId: user.employeeId ?? undefined,
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
        };
      }
      return session;
    },
  },
  secret: authSecret(),
};

// This secret signs the session JWT. A known/shared value means anyone can mint
// an OWNER session, so production refuses to boot without a real one rather
// than falling back to a guessable default.
function authSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 32 && !secret.startsWith('demo-')) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXTAUTH_SECRET is missing or insecure. Generate one with: openssl rand -base64 32'
    );
  }
  return 'dev-only-secret-not-used-in-production-builds';
}

export async function auth() {
  return getServerSession(authOptions);
}