/**
 * Request-body validation: the shared parseBody/fields helpers.
 *
 * Run: npx tsx scripts/test-validation.ts
 *
 * Pure input/output — touches no database and creates nothing, so it is safe to
 * run at any time.
 */
import { z } from 'zod';
import { blankAsUndefined, fields, parseBody } from '@/lib/api-validation';

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

/** Build a Request carrying a JSON body, as a route handler would receive. */
function jsonReq(body: unknown): Request {
  return new Request('https://x.test/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function main() {
  console.log('\n--- parseBody: malformed input ---');
  const notJson = await parseBody(jsonReq('{ not json'), z.object({ a: fields.id }));
  check('rejects a body that is not JSON', !notJson.ok);
  if (!notJson.ok) {
    check('  ...with 400 rather than a 500', notJson.response.status === 400);
  }

  const missing = await parseBody(jsonReq({}), z.object({ id: fields.id }));
  check('rejects a missing required field', !missing.ok);
  if (!missing.ok) {
    const payload = (await missing.response.json()) as {
      details?: Array<{ field: string; message: string }>;
    };
    check(
      '  ...and names the offending field so a client can fix the call',
      payload.details?.some(d => d.field === 'id') === true,
    );
  }

  // A rejected body can contain a password; the error must not echo values back.
  const secret = 'hunter2-should-never-appear';
  const leaky = await parseBody(
    jsonReq({ password: secret, id: 123 }),
    z.object({ id: fields.id }),
  );
  if (!leaky.ok) {
    const text = await leaky.response.text();
    check('error response does not echo submitted values', !text.includes(secret));
  } else {
    check('error response does not echo submitted values (expected reject)', false);
  }

  console.log('\n--- fields.email ---');
  const email = await parseBody(
    jsonReq({ email: '  Owner@Example.COM  ' }),
    z.object({ email: fields.email }),
  );
  check('accepts a valid address', email.ok);
  if (email.ok) {
    // Stored emails are lowercase; normalising here stops a duplicate account
    // being created under different casing.
    check('  ...trims and lowercases it', email.data.email === 'owner@example.com');
  }
  const badEmail = await parseBody(
    jsonReq({ email: 'not-an-email' }),
    z.object({ email: fields.email }),
  );
  check('rejects a malformed address', !badEmail.ok);

  console.log('\n--- fields.count: seats drive billing ---');
  for (const [label, value] of [
    ['zero', 0],
    ['negative', -5],
    ['fractional', 2.5],
    ['absurd', 1e9],
  ] as const) {
    const r = await parseBody(jsonReq({ seats: value }), z.object({ seats: fields.count }));
    check(`rejects ${label} seats (${value})`, !r.ok);
  }
  const okSeats = await parseBody(jsonReq({ seats: 12 }), z.object({ seats: fields.count }));
  check('accepts a sane seat count', okSeats.ok);

  console.log('\n--- fields.password ---');
  const shortPw = await parseBody(
    jsonReq({ password: 'short' }),
    z.object({ password: fields.password }),
  );
  check('rejects a password under 12 characters', !shortPw.ok);
  const goodPw = await parseBody(
    jsonReq({ password: 'correct-horse-battery' }),
    z.object({ password: fields.password }),
  );
  check('accepts a long passphrase', goodPw.ok);

  console.log('\n--- blankAsUndefined: HTML forms submit empty strings ---');
  const formShape = z.object({
    email: fields.email,
    name: blankAsUndefined(fields.name),
    password: blankAsUndefined(fields.password),
  });
  // This is exactly what the admin console's add-user form sends when the
  // vendor leaves the optional fields alone. Requiring them broke this flow.
  const blanks = await parseBody(
    jsonReq({ email: 'new@example.com', name: '', password: '' }),
    formShape,
  );
  check('accepts blank optional fields from a form', blanks.ok);
  if (blanks.ok) {
    check('  ...treating blank name as absent', blanks.data.name === undefined);
    check('  ...treating blank password as absent', blanks.data.password === undefined);
  }
  // Blank means "generate one for me"; a real but weak value is still refused.
  const weak = await parseBody(
    jsonReq({ email: 'new@example.com', name: 'Jo', password: 'abc' }),
    formShape,
  );
  check('still enforces the rules on a non-blank value', !weak.ok);

  console.log('\n--- role: enum, not a cast ---');
  const roleShape = z.object({
    role: z.enum(['OWNER', 'MANAGER', 'VIEWER', 'ASM', 'LEAD', 'REP', 'INTERN']).default('MANAGER'),
  });
  const madeUpRole = await parseBody(jsonReq({ role: 'SUPER_ADMIN' }), roleShape);
  check('rejects a role that is not in the enum', !madeUpRole.ok);
  const defaulted = await parseBody(jsonReq({}), roleShape);
  check('defaults an omitted role to MANAGER', defaulted.ok && defaulted.data.role === 'MANAGER');

  console.log('\n--- checkout tier: price is never client-supplied ---');
  const tierShape = z.object({ tier: z.enum(['STANDARD', 'WHITE_LABEL']) });
  const rawPrice = await parseBody(jsonReq({ priceId: 'price_cheap_test' }), tierShape);
  check('rejects a body offering its own priceId', !rawPrice.ok);
  const tier = await parseBody(jsonReq({ tier: 'STANDARD' }), tierShape);
  check('accepts a known tier name', tier.ok);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed) process.exitCode = 1;
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
