/**
 * Removes operational rows that were written into the WRONG company by the
 * pre-fix workspace scope bug (see lib/workspace.ts header).
 *
 *   npx tsx scripts/backup-tenants.ts          # ALWAYS first
 *   npx tsx scripts/purge-bled-rows.ts         # dry run, prints what it'd do
 *   npx tsx scripts/purge-bled-rows.ts --apply # actually purge
 *
 * Detection: a bled row is identified by SHARED PERSON IDs, not by an identical
 * byte hash. Person ids are minted client-side as `p<epoch-ms>-<seq>`, so two
 * independent companies can never legitimately mint the same id. Once the two
 * copies drift (a shift edited here, an attendance mark there) the hashes stop
 * matching while the stolen identities remain — which is exactly the state this
 * database was found in, so id-overlap is the reliable fingerprint.
 *
 * Safety rules:
 *  - The origin tenant is never touched.
 *  - Every affected row is archived to DataArchive first, so the Recovery portal
 *    can restore it if a judgement call turns out wrong.
 *  - Rows are cleared to an empty value of the same shape rather than dropped,
 *    so the borrowing company keeps a working (empty) book and the app does not
 *    have to special-case a missing key.
 */
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

/** Company whose data is authoritative — never modified. */
const ORIGIN_SLUG = 'sorami';

/** Keys that represent a company's own book and must never be shared. */
const OPERATIONAL_KEYS = [
  'se-people-v1', 'se-attendance-v1', 'se-schedule-v1', 'se-sales-v1',
  'se-teams-v2', 'se-commission-v2', 'se-pnl-v1', 'se-lateouts-v1',
  'se-commit-v1', 'se-goals-v1', 'se-competitions-v1',
  'se-competitions-archive-v1', 'se-mtg-v1', 'se-store-closed-v1',
];

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

/** Person ids present in a `se-people-v1` payload. */
function personIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value
      .map(p => (p && typeof p === 'object' ? (p as { id?: unknown }).id : null))
      .filter((id): id is string => typeof id === 'string')
  );
}

/** Person names present in a `se-people-v1` payload. */
function personNames(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value
      .map(p => (p && typeof p === 'object' ? (p as { name?: unknown }).name : null))
      .filter((n): n is string => typeof n === 'string')
  );
}

/**
 * An "empty but valid" replacement for a key, so the borrowing company is left
 * with a clean working book rather than a missing key.
 */
function emptyFor(key: string): object {
  const arrayKeys = new Set([
    'se-people-v1', 'se-sales-v1', 'se-teams-v2', 'se-pnl-v1',
    'se-competitions-v1', 'se-competitions-archive-v1', 'se-goals-v1',
  ]);
  return arrayKeys.has(key) ? [] : {};
}

async function main() {
  const origin = await prisma.marketOwner.findFirst({ where: { slug: ORIGIN_SLUG } });
  if (!origin) throw new Error(`origin company '${ORIGIN_SLUG}' not found`);

  const originRows = await prisma.tenantData.findMany({
    where: { marketOwnerId: origin.id },
    select: { key: true, value: true },
  });
  const originByKey = new Map(originRows.map(r => [r.key, r.value]));
  const originPeople = originByKey.get('se-people-v1');
  const originIds = personIds(originPeople);
  const originNames = personNames(originPeople);

  console.log(
    `[purge] origin ${origin.name}: ${originIds.size} person ids, ${originNames.size} names`
  );

  const others = await prisma.marketOwner.findMany({
    where: { id: { not: origin.id } },
    select: { id: true, name: true, slug: true },
  });

  let cleared = 0;

  for (const company of others) {
    const rows = await prisma.tenantData.findMany({
      where: { marketOwnerId: company.id, key: { in: OPERATIONAL_KEYS } },
      select: { id: true, key: true, value: true },
    });

    // Does this company's roster share identities with the origin? If so, its
    // whole operational book came from the leak and must be cleared.
    const theirPeople = rows.find(r => r.key === 'se-people-v1')?.value;
    const sharedIds = [...personIds(theirPeople)].filter(id => originIds.has(id));
    const sharedNames = [...personNames(theirPeople)].filter(n => originNames.has(n));

    if (!sharedIds.length) {
      console.log(`[purge] ${company.name}: no shared person ids — clean, skipping`);
      continue;
    }

    console.log(
      `[purge] ${company.name}: BLED — ${sharedIds.length} shared person ids ` +
      `(${sharedNames.slice(0, 3).join(', ')}${sharedNames.length > 3 ? ', …' : ''})`
    );

    for (const row of rows) {
      const isEmpty =
        row.value == null ||
        (Array.isArray(row.value) && row.value.length === 0) ||
        (typeof row.value === 'object' && !Array.isArray(row.value) && Object.keys(row.value as object).length === 0);
      if (isEmpty) continue; // nothing to clear

      cleared++;
      console.log(
        `[purge]${APPLY ? '' : ' DRY'}   clear ${company.name} / ${row.key} (${hash(row.value)})`
      );

      if (!APPLY) continue;

      // Archive before clearing so nothing is unrecoverable.
      try {
        // @ts-expect-error — model may not be migrated on very old checkouts
        await prisma.dataArchive.create({
          data: {
            marketOwnerId: company.id,
            kind: 'BLED_ROW',
            refId: row.key,
            label: `Cross-tenant bleed cleared from ${company.name} — ${row.key}`,
            payload: {
              key: row.key,
              value: row.value,
              matchedOrigin: origin.slug,
              sharedPersonIds: sharedIds,
            } as object,
            deletedBy: 'system:purge-bled-rows',
          },
        });
      } catch {
        console.warn('[purge] DataArchive unavailable — file backup is the safety net');
      }

      await prisma.tenantData.update({
        where: { id: row.id },
        data: { value: emptyFor(row.key) },
      });
    }
  }

  if (!cleared) {
    console.log('[purge] no bled rows found — nothing to do');
  } else if (APPLY) {
    console.log(`[purge] cleared ${cleared} bled row(s). ${origin.name} untouched.`);
  } else {
    console.log(`[purge] ${cleared} row(s) would be cleared. Re-run with --apply.`);
  }
}

main()
  .catch(e => {
    console.error('[purge] FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
