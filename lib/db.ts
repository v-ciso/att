import { PrismaClient } from '@prisma/client';

// Auth reads real user rows now, so a missing DATABASE_URL in production is a
// misconfiguration, not something to paper over — a silent localhost fallback
// would surface as "invalid email or password" on every login attempt.
// Non-production keeps the placeholder so `next build` works without a DB.
if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL is not set — logins cannot be verified.');
  }
  process.env.DATABASE_URL = 'postgresql://preview:preview@localhost:5432/preview';
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
