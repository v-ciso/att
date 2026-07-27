'use client';

import { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  requireTypedConfirmation?: string;
}

/**
 * Promise-based confirmation, so a native `window.confirm(...)` call site can be
 * converted with almost no restructuring:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   ...
 *   if (!(await confirm({ title: '...', description: '...' }))) return;
 *   ...
 *   return <>{ ...ui... }{confirmDialog}</>
 *
 * Why not keep `window.confirm`? It blocks the main thread, it cannot be styled
 * or translated, its text is truncated by some browsers, and — the real problem
 * — browsers let users tick "prevent this page from creating more dialogs",
 * after which `confirm()` returns false forever. A destructive-action guard that
 * a user can permanently disable without noticing is not a guard.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirmDialog = options ? (
    <ConfirmDialog
      open
      // Any dismissal (Escape, overlay click, Cancel) resolves false, so an
      // awaiting caller can never hang.
      onOpenChange={open => { if (!open) settle(false); }}
      onConfirm={() => settle(true)}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      destructive={options.destructive}
      requireTypedConfirmation={options.requireTypedConfirmation}
    />
  ) : null;

  return { confirm, confirmDialog };
}
