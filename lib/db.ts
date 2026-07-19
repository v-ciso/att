import { PrismaClient } from '@prisma/client';

// PREVIEW MODE: no database is required. If DATABASE_URL is not configured
// (e.g. on a Vercel preview with no env vars), fall back to a placeholder so
// PrismaClient can be constructed without crashing at import time. Actual
// queries will fail gracefully in their route handlers — the demo UI never
// calls them. Plug in a real Postgres URL later to re-enable persistence.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://preview:preview@localhost:5432/preview';
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
