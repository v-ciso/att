import { prisma } from '@/lib/db';

// One-time migration: fold each tenant's legacy se-competitions-archive-v1 JSON
// blob (pre-formatted string standings) into first-class Competition +
// CompetitionStanding rows. Idempotent per tenant via a marker key so a re-run
// never double-imports. Dry-run by default; pass --apply to write.

const ARCHIVE_KEY = 'se-competitions-archive-v1';
const DONE_KEY = 'se-competitions-archive-migrated-v1';
const APPLY = process.argv.includes('--apply');

// "$1,240" | "1240" | "42" -> 1240 | 42. Non-numeric junk -> 0.
function parseValue(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v !== 'string') return 0;
  const n = Number(v.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const METRIC_FROM_LABEL: Record<string, string> = {
  'Phone Lines': 'lines', 'Premium Lines': 'premium', 'Internet': 'internet',
  'Next Ups': 'nextUps', 'Office Generated': 'revenue',
};

async function main() {
  console.log(`[migrate-comp] ${APPLY ? 'APPLY' : 'DRY-RUN'} start`);
  const rows = await prisma.tenantData.findMany({ where: { key: ARCHIVE_KEY } });
  console.log(`[migrate-comp] tenants with archive blob: ${rows.length}`);

  let created = 0;
  for (const row of rows) {
    const marketOwnerId = row.marketOwnerId;
    const already = await prisma.tenantData.findUnique({
      where: { marketOwnerId_key: { marketOwnerId, key: DONE_KEY } },
    });
    if (already) { console.log(`[migrate-comp] ${marketOwnerId} already migrated, skipping`); continue; }

    const list = Array.isArray(row.value) ? (row.value as Array<Record<string, unknown>>) : [];
    console.log(`[migrate-comp] ${marketOwnerId}: ${list.length} archived comps`);

    for (const a of list) {
      const metricLabel = String(a.metricLabel ?? '');
      const metric = METRIC_FROM_LABEL[metricLabel] ?? 'lines';
      const storeRaw = String(a.store ?? 'All stores');
      const store = storeRaw === 'All stores' ? null : storeRaw;
      const endedOn = typeof a.endedOn === 'string' ? new Date(a.endedOn) : new Date();
      const standings = Array.isArray(a.standings) ? (a.standings as Array<Record<string, unknown>>) : [];

      if (!APPLY) {
        console.log(`  would import "${a.title}" (${metric}, ${store ?? 'all'}) with ${standings.length} standings`);
        continue;
      }
      await prisma.competition.create({
        data: {
          marketOwnerId,
          title: String(a.title ?? 'Untitled competition'),
          prize: String(a.prize ?? ''),
          metric,
          store,
          periodStart: endedOn,
          periodEnd: endedOn,
          status: 'ended',
          createdBy: 'migration',
          endedAt: endedOn,
          endedBy: 'migration',
          standings: {
            create: standings.map((s, i) => ({
              personId: `name:${String(s.person ?? '').trim().toLowerCase()}`,
              personName: String(s.person ?? 'Unknown'),
              store,
              rank: i + 1,
              value: parseValue(s.value),
              metric,
            })),
          },
        },
      });
      created += 1;
    }

    if (APPLY) {
      await prisma.tenantData.upsert({
        where: { marketOwnerId_key: { marketOwnerId, key: DONE_KEY } },
        create: { marketOwnerId, key: DONE_KEY, value: { at: new Date().toISOString(), count: list.length } },
        update: { value: { at: new Date().toISOString(), count: list.length } },
      });
    }
  }

  console.log(`[migrate-comp] done. competitions created: ${created}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
