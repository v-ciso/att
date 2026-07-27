import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin';
import { getTenantStores, setTenantStores } from '@/lib/provision';

// Vendor-only store setup for a tenant (part of the purchase handoff). A client
// can edit or remove their own stores later; this is the initial provisioning.

export async function GET(request: NextRequest) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = new URL(request.url).searchParams.get('marketOwnerId');
  if (!id) return NextResponse.json({ error: 'marketOwnerId required' }, { status: 400 });
  return NextResponse.json({ stores: await getTenantStores(id) });
}

export async function POST(request: NextRequest) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { marketOwnerId, stores } = await request.json();
    if (!marketOwnerId || !Array.isArray(stores)) {
      return NextResponse.json({ error: 'marketOwnerId and stores[] required' }, { status: 400 });
    }
    return NextResponse.json({ success: true, stores: await setTenantStores(marketOwnerId, stores) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 });
  }
}
