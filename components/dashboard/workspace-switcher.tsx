'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Database, FlaskConical, LogOut, RotateCcw, ShieldCheck, Wand2 } from 'lucide-react';
import { type DataMode, type Workspace, readWorkspace, setWorkspace, clearWorkspaceData, purgeAllLiveBuckets } from '@/lib/workspace';
import { flushTenantSync, stopTenantSync } from '@/lib/tenant-sync';
import { reopenSetup } from './setup-wizard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const CONTROL = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-subtle bg-bg-tertiary px-3 text-sm text-text-primary hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue disabled:opacity-50';

function useWorkspaceControls() {
  const { data: session } = useSession();
  const [workspace, setCurrent] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setCurrent(readWorkspace()), []);
  const superAdmin = session?.user?.isSuperAdmin === true;
  const change = async (mode: DataMode) => {
    if (!superAdmin || busy || workspace?.mode === mode || !session?.user?.marketOwnerId) return;
    setBusy(true); setError('');
    try {
      await flushTenantSync();
      stopTenantSync();
      setWorkspace({ mode, scope: mode === 'live' ? session.user.marketOwnerId : 'demo' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Save failed. Stay here and reload.'); setBusy(false); }
  };
  const logout = async () => {
    setBusy(true); setError('');
    try {
      await flushTenantSync();
      stopTenantSync(); purgeAllLiveBuckets();
      await signOut({ callbackUrl: '/login' });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save before signing out.'); setBusy(false); }
  };
  return { workspace, session, superAdmin, busy, error, change, logout };
}

export function WorkspaceToolbar() {
  const { workspace, session, superAdmin, busy, error, change, logout } = useWorkspaceControls();
  const demo = workspace?.mode === 'demo';
  return <section aria-label="Workspace controls" className="mb-5 flex flex-col rounded-xl border border-border-subtle bg-bg-secondary text-text-primary">
    <div className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 items-center gap-2">
        {demo ? <FlaskConical className="h-5 w-5 shrink-0 text-accent-yellow" /> : <Database className="h-5 w-5 shrink-0 text-accent-green" />}
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{demo ? 'Demo sandbox' : session?.user?.companyName || 'Live workspace'}</p><p className="text-sm text-text-muted">{demo ? 'Sample data only' : 'Live company data · 1-hour session'}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {superAdmin && <label className="sr-only" htmlFor="workspace-mode">Data source</label>}
        {superAdmin && <select id="workspace-mode" aria-label="Data source" className={CONTROL} value={workspace?.mode ?? 'live'} disabled={busy || !workspace} onChange={event => void change(event.target.value as DataMode)}><option value="live">Live data</option><option value="demo">Demo data</option></select>}
        {superAdmin && <Link href="/admin" className={CONTROL}><ShieldCheck className="h-4 w-4" aria-hidden="true" /><span>Admin</span></Link>}
        <button type="button" className={CONTROL} disabled={busy} onClick={() => void logout()}><LogOut className="h-4 w-4" aria-hidden="true" />Sign out</button>
      </div>
    </div>
    {demo && <p className="border-t border-border-subtle px-3 py-2 text-sm text-accent-yellow">Sample stores, reps, and production. Choose Live data above to return to your company.</p>}
    {error && <p role="alert" className="px-3 py-2 text-sm text-accent-red">{error}</p>}
  </section>;
}

export function WorkspaceSwitcher() {
  const { workspace, session, superAdmin, busy, error, change, logout } = useWorkspaceControls();
  const [resetOpen, setResetOpen] = useState(false);
  return <div className="flex flex-col gap-2">
    {superAdmin && <button type="button" className={CONTROL} disabled={busy} onClick={() => void change(workspace?.mode === 'demo' ? 'live' : 'demo')}>{workspace?.mode === 'demo' ? 'Return to live data' : 'Open demo sandbox'}</button>}
    {workspace?.mode === 'live' && session?.user?.role === 'OWNER' && <button type="button" className={CONTROL} onClick={reopenSetup}><Wand2 className="h-4 w-4" aria-hidden="true" />Setup guide</button>}
    {workspace?.mode === 'demo' && superAdmin && <button type="button" className={CONTROL} onClick={() => setResetOpen(true)}><RotateCcw className="h-4 w-4" aria-hidden="true" />Reset demo data</button>}
    <button type="button" className={CONTROL} disabled={busy} onClick={() => void logout()}><LogOut className="h-4 w-4" aria-hidden="true" />Sign out</button>
    {error && <p role="alert" className="text-sm text-accent-red">{error}</p>}
    <ConfirmDialog open={resetOpen} onOpenChange={setResetOpen} onConfirm={() => { if (!superAdmin || readWorkspace().mode !== 'demo') return; clearWorkspaceData({ mode: 'demo', scope: 'demo' }); window.location.reload(); }} title="Reset demo data?" description="Clear sample data only. Your live company data will not change." confirmLabel="Reset demo" destructive />
  </div>;
}
