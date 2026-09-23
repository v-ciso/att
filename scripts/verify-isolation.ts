/**
 * Cross-tenant isolation audit against the live database.
 *
 *   npx tsx scripts/verify-isolation.ts
 *
 * Fails (exit 1) if any two companies share person identities. Person ids are
 * minted client-side as `p<epoch-ms>-<seq>`, so an overlap cannot happen
 * legitimately — it means one company's book was written into another's rows.
 *
 * Skips cleanly when no DATABASE_URL is configured, so it is safe to include in
 * `npm test` on a machine without database access.
 */
import { PrismaClient } from '@prisma/client';

const PEOPLE_KEY = 'se-people-v1';

interface Company {
  id: string;
  name: string;
  slug: string;
}

function personIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value
      .map(p => (p && typeof p === 'object' ? (p as { id?: unknown }).id : null))
      .filter((id): id is string => typeof id === 'string')
  );
}

function personNames(value: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(value)) return out;
  for (const p of value) {
    if (p && typeof p === 'object') {
      const { id, name } = p as { id?: unknown; name?: unknown };
      if (typeof id === 'string' && typeof name === 'string') out.set(id, name);
    }
  }
  return out;
}

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_PRISMA_URL) {
    console.log('isolation: no DATABASE_URL configured — skipping live audit');
    return;
  }

  const prisma = new PrismaClient();
  let failures = 0;

  try {
    const companies: Company[] = await prisma.marketOwner.findMany({
      select: { id: true, name: true, slug: true },
    });

    if (companies.length < 2) {
      console.log(`isolation: only ${companies.length} company — nothing to cross-check`);
      return;
    }

    const rosters = new Map<string, { company: Company; ids: Set<string>; names: Map<string, string> }>();
    for (const company of companies) {
      const row = await prisma.tenantData.findFirst({
        where: { marketOwnerId: company.id, key: PEOPLE_KEY },
        select: { value: true },
      });
      rosters.set(company.id, {
        company,
        ids: personIds(row?.value),
        names: personNames(row?.value),
      });
    }

    // Compare every unordered pair exactly once.
    const entries = Array.from(rosters.values());
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        const shared = Array.from(a.ids).filter(id => b.ids.has(id));
        if (!shared.length) continue;

        failures++;
        const who = shared.map(id => a.names.get(id) ?? id).slice(0, 5);
        console.error(
          `isolation: FAIL — ${a.company.name} and ${b.company.name} share ` +
          `${shared.length} person id(s): ${who.join(', ')}${shared.length > 5 ? ', …' : ''}`
        );
      }
    }

    if (failures) {
      console.error(
        '\nisolation: cross-tenant bleed detected. Run `npx tsx scripts/backup-tenants.ts` ' +
        'then `npx tsx scripts/purge-bled-rows.ts` to inspect and clean.'
      );
      process.exitCode = 1;
      return;
    }

    const total = entries.reduce((n, e) => n + e.ids.size, 0);
    console.log(
      `isolation: all checks passed — ${companies.length} companies, ` +
      `${total} people, zero shared identities`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  // A connection failure must not silently pass as "isolated".
  console.error('isolation: audit could not complete —', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
