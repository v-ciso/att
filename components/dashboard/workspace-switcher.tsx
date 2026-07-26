'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Database, FlaskConical, Lock, LogOut, RotateCcw, Wand2 } from 'lucide-react';
import {
  DataMode, Workspace, DEFAULT_WORKSPACE, readWorkspace, setWorkspace, clearWorkspaceData,
} from '@/lib/workspace';
import { reopenSetup } from './setup-wizard';
import { isSuperAdminEmail } from '@/lib/super-admins';

// Demo vs Live is a real data boundary, not a display filter: each mode reads
// and writes its own localStorage bucket (see lib/workspace.ts).
//
// Only the VENDOR (super-admin) gets the Demo sandbox — it exists to pitch from.
// A customer is always Live and never sees a Demo option, so they can't
// accidentally land in an empty sandbox and think their data vanished.
export function WorkspaceSwitcher() {
  const { data: session } = useSession();
  const [ws, setWs] = useState<Workspace>(DEFAULT_WORKSPACE);
  const [confirmReset, setConfirmReset] = useState(false);

  const superAdmin = isSuperAdminEmail(session?.user?.email);
  const isOwner = session?.user?.role === 'OWNER';
  const tenant = session?.user?.marketOwnerId ?? 'default';

  // Read after mount: the server has no localStorage, so rendering the stored
  // mode directly would hydrate-mismatch.
  useEffect(() => setWs(readWorkspace()), []);

  // Customers are forced Live once (one reload) — the demo bucket is not theirs,
  // and staying in it would leave their real book unsynced.
  useEffect(() => {
    if (!session || superAdmin) return;
    if (readWorkspace().mode !== 'live') {
      setWorkspace({ mode: 'live', scope: session.user?.marketOwnerId ?? 'default' });
    }
  }, [session, superAdmin]);

  const switchTo = (mode: DataMode) => {
    if (mode === ws.mode) return;
    if (mode === 'live' && !isOwner) return;
    setWorkspace({ mode, scope: mode === 'live' ? tenant : 'demo' });
  };

  const resetDemo = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    clearWorkspaceData({ mode: 'demo', scope: 'demo' });
    window.location.reload();
  };

  // Customer view: no demo, just the setup guide (if they're an owner with an
  // empty book) and sign out.
  if (!superAdmin) {
    return (
      <div className="space-y-2">
        {isOwner && (
          <button
            onClick={reopenSetup}
            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-text-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <Wand2 className="w-3 h-3" /> Run setup guide
          </button>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-text-muted hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-3 h-3" /> Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">Data source (vendor)</span>
        {!isOwner && (
          <span className="flex items-center gap-1 text-[10px] text-text-muted" title="Only the account owner can view live data">
            <Lock className="w-2.5 h-2.5" /> locked
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-border-subtle">
        <ModeButton
          mode="demo" active={ws.mode === 'demo'} enabled icon={FlaskConical}
          label="Demo" onClick={() => switchTo('demo')}
        />
        <ModeButton
          mode="live" active={ws.mode === 'live'} enabled={isOwner} icon={Database}
          label="Live" onClick={() => switchTo('live')}
        />
      </div>

      {ws.mode === 'live' && isOwner && (
        <button
          onClick={reopenSetup}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-text-muted hover:text-white hover:bg-white/5 transition-colors"
        >
          <Wand2 className="w-3 h-3" /> Run setup guide
        </button>
      )}

      {ws.mode === 'demo' ? (
        <button
          onClick={resetDemo}
          className={cn(
            'w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition-colors',
            confirmReset
              ? 'bg-accent-red/15 text-accent-red border border-accent-red/30'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          )}
        >
          <RotateCcw className="w-3 h-3" />
          {confirmReset ? 'Click again to wipe demo' : 'Reset demo data'}
        </button>
      ) : (
        <p className="px-1 text-[10px] text-accent-green/80">
          Live numbers — edits here are your real book.
        </p>
      )}

      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-text-muted hover:text-white hover:bg-white/5 transition-colors"
      >
        <LogOut className="w-3 h-3" /> Sign out
      </button>
    </div>
  );
}

function ModeButton({
  active, enabled, icon: Icon, label, onClick,
}: {
  mode: DataMode;
  active: boolean;
  enabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      title={enabled ? `Switch to ${label.toLowerCase()} data` : 'Owner accounts only'}
      className={cn(
        'flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all',
        active && 'bg-accent-blue/20 text-white shadow-inner',
        !active && enabled && 'text-text-secondary hover:text-white hover:bg-white/5',
        !enabled && 'text-text-muted/40 cursor-not-allowed'
      )}
    >
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}
