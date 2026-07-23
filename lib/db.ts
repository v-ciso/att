import { PrismaClient } from '@prisma/client';

// schema.prisma reads POSTGRES_PRISMA_URL — the name the Vercel↔Supabase
// integration injects. Anyone still setting the older DATABASE_URL is honoured
// by mapping it across, so both spellings work.
if (!process.env.POSTGRES_PRISMA_URL) {
  if (process.env.DATABASE_URL) {
    process.env.POSTGRES_PRISMA_URL = process.env.DATABASE_URL;
  } else if (process.env.NODE_ENV === 'production') {
    // Auth reads real user rows now, so a missing URL is a misconfiguration, not
    // something to paper over — a silent localhost fallback would surface as
    // "invalid email or password" on every login attempt.
    throw new Error(
      'No database URL. Connect Supabase (injects POSTGRES_PRISMA_URL) or set DATABASE_URL.'
    );
  } else {
    // Non-production placeholder so `next build` works without a DB.
    process.env.POSTGRES_PRISMA_URL = 'postgresql://preview:preview@localhost:5432/preview';
  }
}
process.env.POSTGRES_URL_NON_POOLING ??= process.env.POSTGRES_PRISMA_URL;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
