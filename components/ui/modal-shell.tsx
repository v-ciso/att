'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useModalA11y } from '@/hooks/use-modal-a11y';

/**
 * Overlay + panel scaffolding for dialogs that are written inline inside a
 * larger component, where a hook cannot be called conditionally.
 *
 * Wrapping the markup in this component means the focus trap, scroll lock and
 * Escape handling come along for free instead of being re-implemented (or
 * forgotten) at each call site.
 */
export function ModalShell({
  label,
  onClose,
  className,
  overlayClassName,
  containerClassName,
  children,
}: {
  label: string;
  onClose: () => void;
  /** Classes for the panel itself. */
  className?: string;
  overlayClassName?: string;
  /** Classes for the full-screen positioning layer. */
  containerClassName?: string;
  children: ReactNode;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-end sm:items-center justify-center', containerClassName)}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className={cn('absolute inset-0 bg-black/70 backdrop-blur-sm', overlayClassName)}
        onClick={onClose}
        aria-hidden="true"
      />
      <div ref={panelRef} tabIndex={-1} className={cn('relative focus:outline-none', className)}>
        {children}
      </div>
    </div>
  );
}
