'use client';

import { forwardRef, HTMLAttributes, useCallback, useEffect, useId, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

/**
 * Shared dialog behaviour for Modal and Drawer.
 *
 * A dialog that only renders a box is not a dialog. Keyboard and screen-reader
 * users need all four of these, none of which were present before:
 *   1. Escape closes.
 *   2. Focus moves INTO the dialog on open, and Tab is trapped inside it —
 *      otherwise focus stays on the page behind and Tab walks off into content
 *      that is visually hidden but still reachable.
 *   3. Focus returns to whatever opened the dialog on close.
 *   4. The background does not scroll behind the overlay.
 */
function useDialogBehaviour(isOpen: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  // Keep the latest onClose without re-running the effect on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusTo.current = document.activeElement as HTMLElement | null;

    const panel = panelRef.current;
    const FOCUSABLE = [
      'a[href]', 'button:not([disabled])', 'input:not([disabled])',
      'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusable = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
        .filter(el => el.offsetParent !== null || el === document.activeElement);

    // Focus the first control, or the panel itself if it has none.
    const first = focusable()[0];
    if (first) first.focus();
    else panel?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusable();
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends so Tab can never escape the dialog.
      if (e.shiftKey && (active === firstItem || !panel?.contains(active))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    // Lock background scroll, preserving the original value.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      // Return focus where the user left it.
      restoreFocusTo.current?.focus?.();
    };
  }, [isOpen]);

  return panelRef;
}

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ className, isOpen, onClose, title, description, size = 'md', children, ...props }, ref) => {
    // useId: two modals mounted at once previously both used id="modal-title",
    // so aria-labelledby could resolve to the wrong dialog's heading.
    const uid = useId();
    const titleId = `modal-title-${uid}`;
    const descId = `modal-desc-${uid}`;
    const panelRef = useDialogBehaviour(isOpen, onClose);

    const setRefs = useCallback((node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }, [panelRef, ref]);

    if (!isOpen) return null;

    const sizes = {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
      full: 'max-w-[90vw]',
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={setRefs}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={twMerge(clsx(
            'relative w-full max-h-[90vh] overflow-y-auto glass rounded-2xl shadow-2xl animate-scale-in',
            'focus-visible:outline-none',
            sizes[size],
            className
          ))}
          {...props}
        >
          {(title || description) && (
            <div className="flex items-start justify-between gap-3 p-5 border-b border-border-subtle">
              <div>
                {title && (
                  <h2 id={titleId} className="text-lg font-semibold text-white">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-sm text-text-secondary">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-none p-2 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-text-secondary hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="p-5">{children}</div>
        </div>
      </div>
    );
  }
);
Modal.displayName = 'Modal';

interface DrawerProps extends Omit<ModalProps, 'size'> {
  side?: 'left' | 'right';
}

export const Drawer = forwardRef<HTMLDivElement, DrawerProps>(
  ({ className, isOpen, onClose, title, description, side = 'right', children, ...props }, ref) => {
    const uid = useId();
    const titleId = `drawer-title-${uid}`;
    const descId = `drawer-desc-${uid}`;
    const panelRef = useDialogBehaviour(isOpen, onClose);

    const setRefs = useCallback((node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }, [panelRef, ref]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex">
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={setRefs}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={twMerge(clsx(
            'relative glass flex flex-col h-full w-full max-w-xl shadow-2xl animate-slide-in',
            'focus-visible:outline-none',
            side === 'right' ? 'ml-auto rounded-l-2xl' : 'mr-auto rounded-r-2xl',
            className
          ))}
          {...props}
        >
          {(title || description) && (
            <div className="flex items-start justify-between gap-3 p-5 border-b border-border-subtle flex-shrink-0">
              <div>
                {title && (
                  <h2 id={titleId} className="text-lg font-semibold text-white">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-sm text-text-secondary">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-none p-2 min-h-11 min-w-11 flex items-center justify-center rounded-lg text-text-secondary hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                aria-label="Close panel"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </div>
      </div>
    );
  }
);
Drawer.displayName = 'Drawer';
