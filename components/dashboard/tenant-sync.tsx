'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { hydrateTenant, installTenantSync } from '@/lib/tenant-sync';
import { readWorkspace } from '@/lib/workspace';

// Mounted once inside the dashboard. In LIVE mode it pulls the tenant's data
// from Postgres into the local cache before the views render their numbers, so
// a fresh device shows the real book instead of an empty one, then keeps it
// synced. In DEMO mode it does nothing (local-only sandbox).
export function TenantSync() {
  const { status, data: session } = useSession();
  const [syncing, setSyncing] = useState(false);
  const sessionTenant = session?.user?.marketOwnerId;

  useEffect(() => {
    if (status !== 'authenticated') return;
    const ws = readWorkspace();
    if (ws.mode !== 'live') return;
    // Never hydrate against a stale prefix: if the local pointer disagrees with
    // the session, WorkspaceSwitcher's reconcile is about to reload the page.
    if (!sessionTenant || ws.scope !== sessionTenant) return;
    let cancelled = false;
    setSyncing(true);
    // Pass the session tenant explicitly so the sync layer can verify bucket
    // ownership rather than trusting whatever prefix the browser happens to be
    // holding.
    hydrateTenant(sessionTenant).finally(() => {
      if (!cancelled) setSyncing(false);
      installTenantSync();
    });
    return () => { cancelled = true; };
  }, [status, sessionTenant]);

  if (!syncing) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-3 py-2 rounded-xl glass border border-border-subtle text-xs text-text-secondary shadow-glass">
      <span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
      Syncing your data…
    </div>
  );
}
