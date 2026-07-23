import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

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

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

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
        token.role = user.role;
        token.marketOwnerId = user.marketOwnerId;
        token.employeeId = user.employeeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id,
          role: token.role,
          marketOwnerId: token.marketOwnerId,
          employeeId: token.employeeId,
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