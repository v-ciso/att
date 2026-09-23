import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canWrite } from '@/lib/permissions';
import { z } from 'zod';
import { parseBody } from '@/lib/api-validation';
import { canonicalPlan } from '@/lib/production-post';

// The tenant's data container. Every read and write is scoped to the caller's
// OWN marketOwnerId, taken from the SESSION and never from the request body.
// That single rule is the isolation guarantee: a signed-in user can only ever
// touch their own company's rows, so company A cannot reach company B's data.

interface SessionUser { id: string; role: string; marketOwnerId?: string }

async function tenantId(): Promise<{ id: string; role: string } | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as SessionUser | undefined;
  if (!u?.marketOwnerId) return null;
  return { id: u.marketOwnerId, role: u.role };
}

// Only these keys are accepted — the app's known operational data. A client
// cannot invent arbitrary keys to bloat a tenant's storage.
const ALLOWED_KEYS = new Set([
  'se-sales-v1', 'se-people-v1', 'se-teams-v2', 'se-commission-v2', 'se-pnl-v1',
  'se-attendance-v1', 'se-lateouts-v1', 'se-commit-v1', 'se-schedule-v1',
  'se-goals-v1', 'se-competitions-v1', 'se-promo-rules-v1', 'se-campaign-v1',
  'se-theme-v1', 'se-store-closed-v1', 'se-mtg-v1', 'se-competitions-archive-v1',
]);

/**
 * A single PUT can never legitimately carry more entries than there are allowed
 * keys, so anything longer is either a bug or an attempt to make us do work.
 */
const ALLOWED_KEYS_MAX = ALLOWED_KEYS.size;

/**
 * Defence in depth against client-side scope drift.
 *
 * The session still decides which rows are touched — this header can never
 * widen access. But a client that *thinks* it is company A while holding a
 * session for company B is a bug we want to fail loudly rather than let it
 * silently overwrite B's book with A's cache (the original leak). 409 tells the
 * client to re-reconcile and reload.
 */
function tenantMismatch(request: NextRequest, sessionTenant: string): boolean {
  const claimed = request.headers.get('X-Tenant-Id');
  return !!claimed && claimed !== sessionTenant;
}

const putSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(120),
        // Deliberately unknown: these are the app's own operational books, whose
        // shapes vary per key and evolve with the app. The protections that
        // matter are the key allowlist and the byte cap below, not a per-key
        // schema that would have to be kept in lockstep with every feature.
        value: z.unknown(),
        expectedUpdatedAt: z.string().datetime().nullable(),
      })
    )
    .max(ALLOWED_KEYS_MAX),
});

/** 8 MB: comfortably above a full season of real data, far below abuse. */
const MAX_PUT_BYTES = 8 * 1024 * 1024;

// Authenticated payloads must never be cached by a proxy or the browser —
// a shared machine could otherwise replay another company's data.
const NO_STORE = { 'Cache-Control': 'no-store, private' } as const;

export async function GET(request: NextRequest) {
  const t = await tenantId();
  if (!t) return NextResponse.json({ error: 'No tenant' }, { status: 401, headers: NO_STORE });

  if (tenantMismatch(request, t.id)) {
    return NextResponse.json(
      { error: 'Tenant scope mismatch', expected: t.id },
      { status: 409, headers: NO_STORE }
    );
  }

  const rows = await prisma.tenantData.findMany({
    where: { marketOwnerId: t.id },
    select: { key: true, value: true, updatedAt: true },
  });
  const data: Record<string, unknown> = {};
  const versions: Record<string, string> = {};
  for (const r of rows) {
    data[r.key] = r.value;
    versions[r.key] = r.updatedAt.toISOString();
  }
  return NextResponse.json({ data, versions }, { headers: NO_STORE });
}

export async function PUT(request: NextRequest) {
  const t = await tenantId();
  if (!t) return NextResponse.json({ error: 'No tenant' }, { status: 401, headers: NO_STORE });
  // Read-only roles are already blocked at the edge for mutating methods, but
  // re-check here so this route is safe on its own.
  //
  // Was `role === 'VIEWER'`, which only named one of the read-only roles: REP and
  // INTERN are equally read-only in the matrix and could still PUT. canWrite()
  // covers every seat that lacks data.write, now and as roles are added.
  if (!canWrite({ role: t.role })) {
    return NextResponse.json({ error: 'Read-only' }, { status: 403, headers: NO_STORE });
  }

  // A write from a client whose idea of "my company" disagrees with its session
  // is rejected outright. This is the server half of the leak fix.
  if (tenantMismatch(request, t.id)) {
    console.log('[v0] rejected cross-tenant write attempt', {
      claimed: request.headers.get('X-Tenant-Id'),
      session: t.id,
    });
    return NextResponse.json(
      { error: 'Tenant scope mismatch — reload required', expected: t.id },
      { status: 409, headers: NO_STORE }
    );
  }

  const parsed = await parseBody(request, putSchema);
  if (!parsed.ok) return parsed.response;
  const { items } = parsed.data;
  if (!items.length) return NextResponse.json({ saved: 0 }, { headers: NO_STORE });

  // The key allowlist is the real guard here; the schema only proves the shape.
  const valid = items.filter(i => ALLOWED_KEYS.has(i.key));

  // Cap the total payload. Values are whole operational books (a season of
  // sales), so they are legitimately large — but without a ceiling a client
  // could park unbounded JSON in a tenant row and run up storage indefinitely.
  const bytes = Buffer.byteLength(JSON.stringify(valid));
  if (bytes > MAX_PUT_BYTES) {
    return NextResponse.json(
      { error: 'Payload too large', maxBytes: MAX_PUT_BYTES, gotBytes: bytes },
      { status: 413, headers: NO_STORE }
    );
  }

  if (valid.length !== items.length || new Set(valid.map(item => item.key)).size !== valid.length) {
    return NextResponse.json({ error: 'Unknown or duplicate data key.' }, { status: 400, headers: NO_STORE });
  }
  const rosterBook = valid.find(item => item.key === 'se-people-v1');
  if (rosterBook && Array.isArray(rosterBook.value)) {
    rosterBook.value = rosterBook.value.map(person => person && typeof person === 'object' && person.role === 'OWNER' ? { ...person, team: '' } : person);
  }
  const salesBook = valid.find(item => item.key === 'se-sales-v1');
  if (salesBook) {
    const details = z.object({
      plan: z.string().min(1).max(120),
      qty: z.number().int().min(1).max(10000),
      upgradePlan: z.string().min(1).max(120).optional(),
      upgradePlanBonus: z.number().finite().min(0).max(10000).optional(),
      convergedQty: z.number().int().min(0).max(10000).optional(),
      convergedBonusPerBundle: z.number().finite().min(0).max(10000).optional(),
    }).passthrough().superRefine((entry, ctx) => {
      if (entry.upgradePlan && canonicalPlan(entry.plan) !== 'Upgrades') ctx.addIssue({ code: 'custom', message: 'Upgrade plan only applies to upgrades.' });
      if (entry.upgradePlanBonus !== undefined && !entry.upgradePlan) ctx.addIssue({ code: 'custom', message: 'A plan supplement requires an upgrade plan.' });
      if (entry.convergedQty && (!/fiber/i.test(canonicalPlan(entry.plan)) || entry.convergedQty > entry.qty)) ctx.addIssue({ code: 'custom', message: 'Converged bundles cannot exceed fiber orders.' });
      if (entry.convergedBonusPerBundle !== undefined && !entry.convergedQty) ctx.addIssue({ code: 'custom', message: 'A converged bonus requires a bundle.' });
    });
    const result = z.array(details).max(100000).safeParse(salesBook.value);
    if (!result.success) return NextResponse.json({ error: 'Invalid sale details: check quantities, upgrade plans, and converged bonuses.' }, { status: 400, headers: NO_STORE });
  }
  try {
    const versions = await prisma.$transaction(async tx => {
      const result: Record<string, string> = {};
      for (const item of valid) {
        const where = { marketOwnerId: t.id, key: item.key };
        const current = await tx.tenantData.findUnique({ where: { marketOwnerId_key: where } });
        if ((current?.updatedAt.toISOString() ?? null) !== item.expectedUpdatedAt) throw new Error('STALE_DATA');
        const updatedAt = new Date(Math.max(Date.now(), (current?.updatedAt.getTime() ?? 0) + 1));
        await tx.tenantData.upsert({
          where: { marketOwnerId_key: where },
          create: { ...where, value: item.value as object, updatedAt },
          update: { value: item.value as object, updatedAt },
        });
        result[item.key] = updatedAt.toISOString();
      }
      return result;
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ saved: valid.length, versions }, { headers: NO_STORE });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if ((error instanceof Error && error.message === 'STALE_DATA') || code === 'P2034' || code === 'P2002') {
      return NextResponse.json({ error: 'Another device changed this data. Your edit was not saved. Reload the latest data before trying again.' }, { status: 409, headers: NO_STORE });
    }
    throw error;
  }
}
