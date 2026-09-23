/**
 * Phase 7 security hardening: audit trail + login throttle.
 *
 * Run: npx tsx scripts/test-security.ts
 *
 * Everything created here is namespaced to a throwaway email/tenant and removed
 * in the finally block, so this is safe to run against the live database.
 */
import { prisma } from '@/lib/db';
import { audit, clientIp, listAuditLog } from '@/lib/audit';
import {
  checkLoginThrottle,
  clearLoginFailures,
  normaliseEmail,
  recordLoginAttempt,
} from '@/lib/rate-limit';

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log('  PASS', label);
  } else {
    failed++;
    console.log('  FAIL', label);
  }
}

const EMAIL = `sec-test-${Date.now()}@example.invalid`;
const IP = '198.51.100.7';

async function main() {
  console.log('\n--- clientIp: header shapes ---');
  // A real Request (Headers instance).
  check(
    'reads x-forwarded-for from a real Request',
    clientIp(new Request('https://x.test', { headers: { 'x-forwarded-for': '203.0.113.5' } })) ===
      '203.0.113.5',
  );
  // The LEFTMOST entry is the client; taking the last would log our own proxy.
  check(
    'takes the leftmost hop, not the proxy',
    clientIp(
      new Request('https://x.test', { headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } }),
    ) === '203.0.113.5',
  );
  check(
    'falls back to x-real-ip',
    clientIp(new Request('https://x.test', { headers: { 'x-real-ip': '203.0.113.6' } })) ===
      '203.0.113.6',
  );
  // NextAuth's authorize() hands over a POJO, not a Headers instance. Handling
  // only the latter is what silently nulled the ip on every sign-in row.
  check(
    'reads plain-object headers (the NextAuth authorize shape)',
    clientIp({ headers: { 'x-forwarded-for': '203.0.113.9' } } as unknown as Request) ===
      '203.0.113.9',
  );
  check('tolerates a missing request', clientIp(null) === null);

  console.log('\n--- rate limit: normalisation ---');
  check('lowercases', normaliseEmail('Rep@Example.COM') === 'rep@example.com');
  check('trims', normaliseEmail('  rep@example.com  ') === 'rep@example.com');

  console.log('\n--- rate limit: lockout ---');
  await clearLoginFailures(EMAIL);
  const fresh = await checkLoginThrottle(EMAIL, IP);
  check('a clean email is allowed', fresh.allowed === true);

  // 8 is MAX_PER_EMAIL. Seven strikes must still let them in — people fat-finger
  // passwords, and locking on the 7th would be a support call, not security.
  for (let i = 0; i < 7; i++) await recordLoginAttempt(EMAIL, IP, false);
  check('still allowed at 7 failures', (await checkLoginThrottle(EMAIL, IP)).allowed === true);

  await recordLoginAttempt(EMAIL, IP, false);
  const locked = await checkLoginThrottle(EMAIL, IP);
  check('locked at 8 failures', locked.allowed === false);
  check('lockout blames the email counter', !locked.allowed && locked.reason === 'email');
  check('lockout reports a retry window', !locked.allowed && locked.retryAfterMinutes > 0);

  // A different address must still be refused: the lock is on the account, so
  // hopping IPs cannot be a bypass.
  const other = await checkLoginThrottle(EMAIL, '198.51.100.250');
  check('lock follows the account across addresses', other.allowed === false);

  // Casing must not dodge the counter.
  const upper = await checkLoginThrottle(EMAIL.toUpperCase(), IP);
  check('uppercased email hits the same counter', upper.allowed === false);

  // An unrelated account from a quiet address is unaffected.
  const bystander = await checkLoginThrottle(`other-${Date.now()}@example.invalid`, '198.51.100.251');
  check('an unrelated account is not collateral damage', bystander.allowed === true);

  console.log('\n--- rate limit: recovery ---');
  await clearLoginFailures(EMAIL);
  check('clearing failures unlocks', (await checkLoginThrottle(EMAIL, IP)).allowed === true);

  // Successes must not count toward the limit, or a busy shared office would
  // throttle itself out of the app.
  for (let i = 0; i < 12; i++) await recordLoginAttempt(EMAIL, IP, true);
  check('successful attempts do not accumulate', (await checkLoginThrottle(EMAIL, IP)).allowed === true);

  console.log('\n--- audit trail ---');
  const tenant = await prisma.marketOwner.findFirst({ select: { id: true } });
  if (!tenant) {
    console.log('  (skipped tenant-scoped checks: no MarketOwner rows)');
  } else {
    await audit({
      action: 'auth.login',
      actor: { email: EMAIL, role: 'REP', marketOwnerId: tenant.id },
      ip: '203.0.113.44',
      userAgent: 'SecTest/1.0',
      meta: { note: 'phase7 selftest' },
    });
    const rows = await listAuditLog(tenant.id, { limit: 50 });
    const mine = rows.find(r => r.actorEmail === EMAIL);
    check('row is written and readable', !!mine);
    check('explicit ip override is stored', mine?.ip === '203.0.113.44');
    check('user agent is stored', mine?.userAgent === 'SecTest/1.0');
    check('tenant is stamped', mine?.marketOwnerId === tenant.id);

    // The reader is scoped by tenant, so another tenant's id must not see it.
    const otherTenant = await prisma.marketOwner.findFirst({
      where: { id: { not: tenant.id } },
      select: { id: true },
    });
    if (otherTenant) {
      const foreign = await listAuditLog(otherTenant.id, { limit: 50 });
      check(
        'audit rows do not leak across tenants',
        !foreign.some(r => r.actorEmail === EMAIL),
      );
    }

    // Filtering by action is what makes the trail usable during an incident.
    const filtered = await listAuditLog(tenant.id, { action: 'auth.login', limit: 50 });
    check('action filter works', filtered.every(r => r.action === 'auth.login'));
  }

  // An audit failure must never propagate: it runs after the real work has
  // already committed, so throwing would report a false failure to the caller.
  let threw = false;
  try {
    await audit({
      action: 'auth.login',
      // Deliberately invalid: actorEmail is non-nullable in the schema.
      actor: { email: null as unknown as string, role: 'REP' },
    });
  } catch {
    threw = true;
  }
  check('a failed audit write is swallowed, not thrown', threw === false);
}

main()
  .catch(err => {
    console.error('suite crashed:', err);
    failed++;
  })
  .finally(async () => {
    await prisma.loginAttempt.deleteMany({ where: { email: normaliseEmail(EMAIL) } });
    await prisma.auditLog.deleteMany({ where: { actorEmail: EMAIL } });
    await prisma.$disconnect();
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
