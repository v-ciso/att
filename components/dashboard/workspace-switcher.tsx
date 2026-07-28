'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Database, FlaskConical, Lock, LogOut, RotateCcw, Wand2 } from 'lucide-react';
import {
  DataMode, Workspace, DEFAULT_WORKSPACE, readWorkspace, setWorkspace, clearWorkspaceData,
  reconcileWorkspace, purgeAllLiveBuckets,
} from '@/lib/workspace';
import { reopenSetup } from './setup-wizard';
import { can } from '@/lib/permissions';
import { isSuperAdminEmail } from '@/lib/super-admins';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Demo vs Live is a real data boundary, not a display filter: each mode reads
// and writes its own localStorage bucket (see lib/workspace.ts).
//
// Only the VENDOR (super-admin) gets the Demo sandbox — it exists to pitch from.
// A customer is always Live and never sees a Demo option, so they can't
// accidentally land in an empty sandbox and think their data vanished.

/** Shared row styling. min-h-11 keeps every control at the 44px touch target. */
const ROW =
  'w-full flex items-center gap-2 px-3 py-2 min-h-11 rounded-lg text-xs font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]';

export function WorkspaceSwitcher() {
  const { data: session } = useSession();
  const [ws, setWs] = useState<Workspace>(DEFAULT_WORKSPACE);
  const [resetOpen, setResetOpen] = useState(false);

  // Routed through the capability matrix so "who gets the Demo sandbox" has one
  // definition shared with the sidebar and middleware. The email fallback covers
  // sessions minted before isSuperAdmin was stamped into the JWT.
  const superAdmin = can(
    {
      role: session?.user?.role,
      isSuperAdmin: session?.user?.isSuperAdmin ?? isSuperAdminEmail(session?.user?.email),
    },
    'workspace.demo'
  );
  const isOwner = session?.user?.role === 'OWNER';
  const tenant = session?.user?.marketOwnerId ?? 'default';

  // Read after mount: the server has no localStorage, so rendering the stored
  // mode directly would hydrate-mismatch.
  useEffect(() => setWs(readWorkspace()), []);

  // Customers are forced Live once (one reload) — the demo bucket is not theirs,
  // and staying in it would leave their real book unsynced.
  //
  // Critically this reconciles on EVERY session change, including when the mode
  // is already 'live'. The old "only if mode !== live" check let a browser keep
  // the previous user's tenant prefix after a new sign-in, which is how one
  // company's roster ended up written into another's rows.
  useEffect(() => {
    if (!session || superAdmin) return;
    const tenantId = session.user?.marketOwnerId;
    if (!tenantId) return;
    reconcileWorkspace(tenantId); // reloads if a correction was needed
  }, [session, superAdmin]);

  // Super-admins may sit in Demo deliberately, but their LIVE bucket must still
  // be attributed to the right tenant before any sync can run.
  useEffect(() => {
    if (!session || !superAdmin) return;
    const tenantId = session.user?.marketOwnerId;
    if (!tenantId) return;
    const current = readWorkspace();
    if (current.mode === 'live' && current.scope !== tenantId) {
      reconcileWorkspace(tenantId);
    }
  }, [session, superAdmin]);

  // Sign-out must leave no company's cached book behind on this device.
  const handleSignOut = () => {
    purgeAllLiveBuckets();
    signOut({ callbackUrl: '/login' });
  };

  const switchTo = (mode: DataMode) => {
    if (mode === ws.mode) return;
    if (mode === 'live' && !isOwner) return;
    setWorkspace({ mode, scope: mode === 'live' ? tenant : 'demo' });
  };

  const resetDemo = () => {
    clearWorkspaceData({ mode: 'demo', scope: 'demo' });
    window.location.reload();
  };

  const setupButton = (
    <button onClick={reopenSetup} className={cn(ROW, 'text-text-secondary hover:text-white hover:bg-white/5')}>
      <Wand2 className="w-4 h-4 flex-none" aria-hidden="true" />
      Run setup guide
    </button>
  );

  const signOutButton = (
    <button onClick={handleSignOut} className={cn(ROW, 'text-text-secondary hover:text-white hover:bg-white/5')}>
      <LogOut className="w-4 h-4 flex-none" aria-hidden="true" />
      Sign out
    </button>
  );

  // Customer view: no demo, just the setup guide (if they're an owner with an
  // empty book) and sign out.
  if (!superAdmin) {
    return (
      <div className="space-y-1">
        {isOwner && setupButton}
        {signOutButton}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[11px] uppercase tracking-wider text-text-secondary">
          Data source (vendor)
        </span>
        {!isOwner && (
          <span className="flex items-center gap-1 text-[11px] text-text-secondary">
            <Lock className="w-3 h-3 flex-none" aria-hidden="true" />
            locked
          </span>
        )}
      </div>

      {/* A real radiogroup: arrow keys move between modes and the active mode is
          announced, rather than being conveyed by background colour alone. */}
      <div
        role="radiogroup"
        aria-label="Data source"
        className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-border-subtle"
      >
        <ModeButton
          active={ws.mode === 'demo'} enabled icon={FlaskConical}
          label="Demo" onClick={() => switchTo('demo')}
        />
        <ModeButton
          active={ws.mode === 'live'} enabled={isOwner} icon={Database}
          label="Live" onClick={() => switchTo('live')}
          disabledReason="Owner accounts only"
        />
      </div>

      {!isOwner && (
        <p className="px-1 text-[11px] text-text-secondary">
          Only the account owner can switch to live data.
        </p>
      )}

      {ws.mode === 'live' && isOwner && setupButton}

      {ws.mode === 'demo' ? (
        <button
          onClick={() => setResetOpen(true)}
          className={cn(ROW, 'text-text-secondary hover:text-white hover:bg-white/5')}
        >
          <RotateCcw className="w-4 h-4 flex-none" aria-hidden="true" />
          Reset demo data
        </button>
      ) : (
        <p className="px-1 text-[11px] text-accent-green">
          Live numbers — edits here are your real book.
        </p>
      )}

      {signOutButton}

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={resetDemo}
        title="Reset demo data?"
        description="This wipes every sample figure in the Demo sandbox and reloads the page. Your live book is not touched."
        confirmLabel="Wipe demo data"
        destructive
      />
    </div>
  );
}

function ModeButton({
  active, enabled, icon: Icon, label, onClick, disabledReason,
}: {
  active: boolean;
  enabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={!enabled}
      // aria-disabled keeps the control discoverable to screen readers while
      // `disabled` stops activation; the reason is text, not just a tooltip.
      aria-disabled={!enabled}
      aria-describedby={!enabled && disabledReason ? `mode-${label}-reason` : undefined}
      className={cn(
        'flex items-center justify-center gap-1.5 px-2 py-2 min-h-11 rounded-lg text-xs font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
        active && 'bg-accent-blue/30 text-white shadow-inner',
        !active && enabled && 'text-text-secondary hover:text-white hover:bg-white/5',
        !enabled && 'text-text-muted cursor-not-allowed'
      )}
    >
      <Icon className="w-4 h-4 flex-none" aria-hidden="true" />
      {label}
      {!enabled && disabledReason && (
        <span id={`mode-${label}-reason`} className="sr-only">
          {disabledReason}
        </span>
      )}
    </button>
  );
}
