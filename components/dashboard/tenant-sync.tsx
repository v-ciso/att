'use client';

import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import useSWR from 'swr';
import { getSyncError, hydrateTenant, stopTenantSync, subscribeSync } from '@/lib/tenant-sync';
import { readWorkspace, reconcileWorkspace, purgeAllLiveBuckets, WORKSPACE_KEY, type Workspace } from '@/lib/workspace';

// This boundary lives ABOVE page components: their effects cannot read stale or
// demo defaults while the signed-in company's data is still loading.
export function TenantSync({ children }: { children: ReactNode }) {
  const { status, data: session } = useSession();
  const pathname = usePathname();
  const protectedPage = /^\/(dashboard|settings|people|admin)(\/|$)/.test(pathname);
  const needsData = protectedPage && !pathname.startsWith('/admin');
  const tenant = session?.user?.marketOwnerId;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [expired, setExpired] = useState(false);
  const saveError = useSyncExternalStore(subscribeSync, getSyncError, () => '');

  useEffect(() => {
    if (!protectedPage || status === 'loading') return;
    const expire = () => {
      setExpired(true);
      stopTenantSync();
      purgeAllLiveBuckets();
      void signOut({ callbackUrl: '/login' });
    };
    if (!session?.user?.id || !session.sessionExpiresAt || session.sessionExpiresAt <= Date.now()) {
      expire();
      return;
    }
    setExpired(false);
    const deadline = session.sessionExpiresAt;
    const check = () => { if (Date.now() >= deadline) expire(); };
    const timer = setTimeout(expire, deadline - Date.now());
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => { clearTimeout(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [protectedPage, status, session?.user?.id, session?.sessionExpiresAt]);

  useEffect(() => {
    if (!needsData || !tenant) return;
    const current = readWorkspace();
    const explicitDemo = session?.user?.isSuperAdmin && current.mode === 'demo' && window.localStorage.getItem(WORKSPACE_KEY) !== null;
    if (!explicitDemo && reconcileWorkspace(tenant)) return;
    setWorkspace(readWorkspace());
    const checkWorkspace = (event: StorageEvent) => {
      if (event.key === WORKSPACE_KEY) { stopTenantSync(); window.location.reload(); }
    };
    window.addEventListener('storage', checkWorkspace);
    return () => window.removeEventListener('storage', checkWorkspace);
  }, [needsData, tenant, session?.user?.isSuperAdmin]);

  const readyToLoad = needsData && workspace?.mode === 'live' && workspace.scope === tenant;
  const { data: loaded, error, mutate } = useSWR(
    readyToLoad ? ['tenant-bootstrap', tenant] : null,
    ([, id]) => hydrateTenant(id!),
    { refreshInterval: 15_000, revalidateOnFocus: true, shouldRetryOnError: false, keepPreviousData: false },
  );

  if (!protectedPage) return <>{children}</>;
  if (expired) return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg-primary text-text-primary"><p>Your one-hour session has ended.</p><a href="/login" className="min-h-11 rounded-lg border border-border-subtle px-4 py-2 text-sm">Sign in again</a></main>;
  if (status === 'loading' || !session?.user?.id || (needsData && !workspace)) return <Loading />;
  if (saveError || error) return <main className="flex min-h-dvh flex-col items-center justify-center bg-bg-primary px-6 text-text-primary"><div className="flex max-w-lg flex-col gap-4"><h1 className="text-xl font-semibold">Live data needs attention</h1><p role="alert" className="text-sm leading-6 text-text-secondary">{saveError || error.message}</p><p className="text-sm leading-6 text-text-secondary">No other company or demo data is shown. Reloading discards unsaved edits on this device.</p><button className="min-h-11 rounded-lg bg-bg-tertiary px-4 text-text-primary" onClick={() => saveError ? window.location.reload() : void mutate()}>Reload latest data</button><button className="min-h-11 rounded-lg border border-border-subtle px-4 text-text-secondary" onClick={() => { stopTenantSync(); purgeAllLiveBuckets(); void signOut({ callbackUrl: '/login' }); }}>Sign out</button></div></main>;
  if (readyToLoad && !loaded) return <Loading />;
  return <>{children}</>;
}

function Loading() {
  return <main className="flex min-h-dvh items-center justify-center bg-bg-primary text-text-secondary"><p role="status" className="text-sm">Loading your workspace…</p></main>;
}
