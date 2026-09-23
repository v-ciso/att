'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { RotateCcw, Trash2, Undo2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/use-confirm';
import { useAnnounce } from '@/components/a11y/announcer';
import { notifyDataChanged } from '@/lib/sales';
import { fetchArchives, restoreEntity, purgeEntity, type ArchiveItem } from '@/lib/archive-client';
import { readWorkspace } from '@/lib/workspace';
import { localArchiveList, localArchiveTake, localArchivePurge } from '@/lib/local-archive';

// Demo restore: put the archived payload back into the demo bucket's own
// `se-*` key. The workspace shim prefixes these into `demo:` automatically,
// so this can never touch a live company's data.
const RESTORE_TARGET_KEY: Record<string, string> = {
  PERSON: 'se-people-v1',
  COMPETITION: 'se-competitions-v1',
};

function localRestorePayload(kind: string, payload: unknown): boolean {
  const key = RESTORE_TARGET_KEY[kind];
  if (!key || !payload || typeof payload !== 'object') return false;
  try {
    const raw = window.localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return false;
    const id = (payload as { id?: string }).id;
    const next = id ? list.filter((x: { id?: string }) => x.id !== id) : list;
    next.push(payload);
    window.localStorage.setItem(key, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

const KIND_LABEL: Record<string, string> = {
  PERSON: 'Employee',
  STORE: 'Store',
  COMPETITION: 'Competition',
  TENANT_SNAPSHOT: 'Full snapshot',
  BLED_ROW: 'Recovered data',
};

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

// The company recycle bin. An OWNER sees and restores their own company's
// archived items; a super-admin additionally sees a company column and can
// permanently purge (typed confirm + reason). Restoring a PERSON re-writes the
// roster blob via the same tenant-sync path the roster uses, so the row simply
// reappears on the next sync.
export function RecycleBin() {
  const { data: session } = useSession();
  const isSuper = !!session?.user?.isSuperAdmin;
  const { confirm, confirmDialog } = useConfirm();
  const announce = useAnnounce();

  // Captured once per mount — switching workspaces reloads the page, so this
  // cannot go stale. In demo mode this component reads/writes ONLY the local
  // demo bin; the server bin (real retention data) is never even fetched.
  const [isDemo] = useState(() => readWorkspace().mode === 'demo');

  const [items, setItems] = useState<ArchiveItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (isDemo) {
      const local = localArchiveList();
      setItems(
        local.map((l) => ({
          id: l.id,
          kind: l.kind,
          refId: l.refId,
          label: l.label,
          reason: l.reason ?? null,
          deletedAt: l.deletedAt,
          restoredAt: null,
          purgedAt: null,
          companyName: 'Demo sandbox',
          payload: l.payload,
        })) as unknown as ArchiveItem[]
      );
      return;
    }
    try {
      const data = await fetchArchives();
      setItems(data);
    } catch {
      setError('Could not load the recycle bin. Please try again.');
      setItems([]);
    }
  }, [isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = (items ?? []).filter((i) => !i.restoredAt && !i.purgedAt);

  const onRestore = async (item: ArchiveItem) => {
    const ok = await confirm({
      title: `Restore ${item.label}?`,
      description: 'This returns the item to its company. For an employee, they reappear on the roster with their original employee code and history.',
      confirmLabel: 'Restore',
    });
    if (!ok) return;
    setBusyId(item.id);
    try {
      if (isDemo) {
        const taken = localArchiveTake(item.id);
        if (!taken || !localRestorePayload(taken.kind, taken.payload)) {
          throw new Error('local restore failed');
        }
      } else {
        await restoreEntity(item.id);
      }
      // A restored PERSON/STORE edits tenant data; nudge every open view to
      // re-pull so the roster/board updates without a manual refresh.
      notifyDataChanged();
      announce(`${item.label} restored.`);
      await load();
    } catch {
      announce(`Could not restore ${item.label}.`);
      setError(`Could not restore ${item.label}. Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  const onPurge = async (item: ArchiveItem) => {
    const ok = await confirm({
      title: `Permanently delete ${item.label}?`,
      description: 'This cannot be undone. The item is erased from the recycle bin for good. Type the label to confirm.',
      confirmLabel: 'Delete forever',
      destructive: true,
      requireTypedConfirmation: item.label,
    });
    if (!ok) return;
    setBusyId(item.id);
    try {
      const purged = isDemo
        ? localArchivePurge(item.id)
        : await purgeEntity(item.id, 'Purged from recycle bin by super-admin', item.companyName ?? item.label);
      if (!purged) throw new Error('purge failed');
      announce(`${item.label} permanently deleted.`);
      await load();
    } catch {
      announce(`Could not delete ${item.label}.`);
      setError(`Could not delete ${item.label}. Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-xl font-bold neon-brand flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Recycle Bin
            {isDemo && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 border border-border-subtle text-text-secondary font-normal">
                Demo sandbox
              </span>
            )}
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            {isDemo
              ? 'This is the demo sandbox\u2019s own bin \u2014 completely separate from your live company. Demo archives never appear in the live Recycle Bin, and resetting the demo clears this too.'
              : `Archived employees, stores and competitions live here. Restore anything you removed by mistake${isSuper ? '. As a super-admin you can also permanently delete items.' : '. Deleted items are kept until an administrator purges them.'}`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load()}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-accent-red/10 border border-accent-red/25 text-accent-red text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-none" /> {error}
        </div>
      )}

      {items === null ? (
        <p className="text-sm text-text-muted py-8 text-center">Loading recycle bin…</p>
      ) : active.length === 0 ? (
        <div className="py-12 text-center">
          <Undo2 className="w-8 h-8 mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">The recycle bin is empty.</p>
          <p className="text-xs text-text-muted mt-1">Anything you archive from the roster or other boards will show up here, ready to restore.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
                <th scope="col" className="pb-2 pr-2">Item</th>
                <th scope="col" className="pb-2 pr-2">Type</th>
                {isSuper && <th scope="col" className="pb-2 pr-2">Company</th>}
                <th scope="col" className="pb-2 pr-2">Deleted</th>
                <th scope="col" className="pb-2 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {active.map((item) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2 pr-2 font-medium">{item.label}</td>
                  <td className="py-2 pr-2">
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/5 border border-border-subtle text-text-secondary">
                      {KIND_LABEL[item.kind] ?? item.kind}
                    </span>
                  </td>
                  {isSuper && <td className="py-2 pr-2 text-text-secondary">{item.companyName ?? '—'}</td>}
                  <td className="py-2 pr-2 text-text-muted">{fmt(item.deletedAt)}</td>
                  <td className="py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => onRestore(item)}
                        disabled={busyId === item.id}
                        className="px-2 py-1 rounded-lg text-accent-green hover:bg-accent-green/10 transition-all inline-flex items-center gap-1 disabled:opacity-50"
                        aria-label={`Restore ${item.label}`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                      {(isSuper || isDemo) && (
                        <button
                          onClick={() => onPurge(item)}
                          disabled={busyId === item.id}
                          className="px-2 py-1 rounded-lg text-accent-red hover:bg-accent-red/10 transition-all inline-flex items-center gap-1 disabled:opacity-50"
                          aria-label={`Permanently delete ${item.label}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
