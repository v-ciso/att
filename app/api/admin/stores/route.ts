import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin';
import { getTenantStores, setTenantStores } from '@/lib/provision';
import { z } from 'zod';
import { fields, parseBody } from '@/lib/api-validation';

// Vendor-only store setup for a tenant (part of the purchase handoff). A client
// can edit or remove their own stores later; this is the initial provisioning.

const setStoresSchema = z.object({
  marketOwnerId: fields.id,
  // The array was only checked with Array.isArray, so its CONTENTS were free
  // form: setTenantStores would String()/Number() whatever arrived, quietly
  // turning a bad multiplier into 1. Validating here means a malformed rule is
  // rejected rather than silently rewritten into a wrong commission rate.
  stores: z
    .array(
      z.object({
        name: fields.name,
        // A multiplier scales commission, so keep it positive and sane.
        multiplier: z.number().finite().positive().max(100),
      })
    )
    .max(500),
});

export async function GET(request: NextRequest) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('marketOwnerId');
  if (!id) return NextResponse.json({ error: 'marketOwnerId required' }, { status: 400 });
  return NextResponse.json({ stores: await getTenantStores(id) });
}

export async function POST(request: NextRequest) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = await parseBody(request, setStoresSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const { marketOwnerId, stores } = parsed.data;
    return NextResponse.json({ success: true, stores: await setTenantStores(marketOwnerId, stores) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 });
  }
}
