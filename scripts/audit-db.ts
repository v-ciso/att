// Read-only security audit of the live database.
//   npx tsx scripts/audit-db.ts
// Prints no secrets. Checks the things that actually decide whether a tenant's
// data is safe: RLS enabled per table, policies present, and what the PUBLIC
// anon key can reach through PostgREST.
import { prisma } from '../lib/db';

async function main() {
  const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string; rls: boolean; forced: boolean }>>(`
    SELECT c.relname AS tablename,
           c.relrowsecurity AS rls,
           c.relforcerowsecurity AS forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  const policies = await prisma.$queryRawUnsafe<Array<{ tablename: string; policyname: string; cmd: string }>>(`
    SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename
  `);

  const grants = await prisma.$queryRawUnsafe<Array<{ table_name: string; grantee: string; privilege_type: string }>>(`
    SELECT table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
    ORDER BY table_name, grantee
  `);

  const byTable = new Map<string, string[]>();
  policies.forEach(p => byTable.set(p.tablename, [...(byTable.get(p.tablename) ?? []), `${p.policyname}(${p.cmd})`]));

  console.log('\n  TABLE                 RLS      POLICIES');
  console.log('  ' + '-'.repeat(60));
  let unprotected = 0;
  for (const t of tables) {
    const pol = byTable.get(t.tablename) ?? [];
    // The dangerous combination is RLS off while anon/authenticated hold grants:
    // PostgREST would then serve every row to anyone holding the public key.
    const anonGrants = grants.filter(g => g.table_name === t.tablename);
    const risky = !t.rls && anonGrants.length > 0;
    if (risky) unprotected++;
    console.log(
      `  ${t.tablename.padEnd(20)} ${(t.rls ? 'ON ' : 'OFF').padEnd(8)} ${pol.length ? pol.join(', ') : '(none)'}` +
      (risky ? `   <-- EXPOSED to ${Array.from(new Set(anonGrants.map(g => g.grantee))).join('/')}` : '')
    );
  }

  const anonTables = Array.from(new Set(grants.filter(g => g.grantee === 'anon').map(g => g.table_name)));
  console.log(`\n  Tables granted to the PUBLIC anon role: ${anonTables.length ? anonTables.join(', ') : '(none)'}`);
  console.log(`  Tables with RLS OFF *and* anon/authenticated grants: ${unprotected}`);
  console.log(unprotected === 0
    ? '  => No table is readable with the public key alone.\n'
    : '  => THESE ARE READABLE BY ANYONE WITH THE ANON KEY. Fix before real data.\n');
}

main()
  .catch(e => { console.error('  audit failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
