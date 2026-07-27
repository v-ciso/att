/**
 * Full, non-destructive snapshot of every tenant's operational data.
 *
 * Run this BEFORE any migration, purge, or schema change:
 *
 *   npx tsx scripts/backup-tenants.ts
 *
 * Writes one JSON file per company to .backups/ and — once the DataArchive
 * table exists — also records the snapshot in-database so it is restorable
 * from the Recovery portal without shell access.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OUT_DIR = join(process.cwd(), '.backups');

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const at = stamp();

  const companies = await prisma.marketOwner.findMany({
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  let totalRows = 0;

  for (const company of companies) {
    const [rows, users] = await Promise.all([
      prisma.tenantData.findMany({
        where: { marketOwnerId: company.id },
        select: { key: true, value: true, updatedAt: true },
      }),
      prisma.user.findMany({
        where: { marketOwnerId: company.id },
        select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true },
      }),
    ]);

    const payload = {
      snapshotAt: at,
      company,
      users,
      data: rows.reduce<Record<string, unknown>>((acc, r) => {
        acc[r.key] = r.value;
        return acc;
      }, {}),
      keyMeta: rows.map(r => ({ key: r.key, updatedAt: r.updatedAt })),
    };

    const file = join(OUT_DIR, `tenant-${company.slug}-${at}.json`);
    writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
    totalRows += rows.length;
    console.log(`[backup] ${company.name} (${company.slug}) — ${rows.length} keys, ${users.length} users -> ${file}`);

    // Best-effort in-database archive. Skipped silently if the table has not
    // been migrated yet, so this script is safe to run at any point.
    try {
      // @ts-expect-error — model may not exist yet on first run
      await prisma.dataArchive.create({
        data: {
          marketOwnerId: company.id,
          kind: 'TENANT_SNAPSHOT',
          refId: `${company.slug}-${at}`,
          label: `Full snapshot — ${company.name} — ${at}`,
          payload: payload as object,
          deletedBy: 'system:backup-tenants',
        },
      });
    } catch {
      /* DataArchive not migrated yet — file backup already written */
    }
  }

  console.log(`[backup] done — ${companies.length} companies, ${totalRows} data keys, snapshot ${at}`);
}

main()
  .catch(e => {
    console.error('[backup] FAILED — do not proceed with any purge:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
