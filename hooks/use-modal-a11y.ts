'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Remember the last thing focused *outside* any dialog so a modal can hand focus
// back on close. Reading document.activeElement inside the open effect is not
// enough: React applies `autoFocus` during commit, before effects run, so a
// dialog with an autoFocus field would capture its own input as the "opener" and
// then restore focus to a detached node, dropping the user back on <body>.
let lastExternalFocus: HTMLElement | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener(
    'focusin',
    e => {
      const el = e.target as HTMLElement | null;
      if (el && !el.closest('[role="dialog"]')) lastExternalFocus = el;
    },
    true
  );
}

/**
 * Standard modal behaviour, in one place: move focus into the dialog on open,
 * keep Tab cycling inside it, lock background scroll, and restore focus to
 * whatever opened it on close.
 *
 * Without this a keyboard or screen-reader user stays parked on the page behind
 * the overlay — they tab through content they cannot see and never reach the
 * dialog's own controls.
 *
 * @param onClose  Called on Escape. Pass undefined for a dialog that must not be
 *                 dismissible (a required first-run setup step, for example);
 *                 focus containment still applies.
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(onClose?: () => void) {
  const ref = useRef<T>(null);

  // Callers pass inline arrows (`onClose={() => setOpen(null)}`), so depending on
  // onClose directly re-ran this effect on every render — each pass tore down the
  // trap and snapped focus back to the first control, making the dialog
  // impossible to tab through. Keep the latest callback in a ref and set the
  // trap up exactly once per mount.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    // Prefer the tracked external element; fall back to activeElement only when
    // it is genuinely outside this dialog.
    const opener =
      lastExternalFocus ?? (active && !ref.current?.contains(active) ? active : null);

    // Focus the first real control so the user lands on something actionable,
    // falling back to the container itself when the dialog is text-only.
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;

      const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) return;

      const head = items[0];
      const tail = items[items.length - 1];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Returning focus to the trigger keeps keyboard users from being dumped
      // back at the top of the document. Skip nodes React has since unmounted —
      // focusing a detached element silently sends focus to <body>.
      console.log('[v0] modal cleanup restore ->', {
        opener: opener?.tagName + ':' + (opener?.textContent || '').trim().slice(0, 18),
        connected: opener?.isConnected,
        usedTracked: opener === lastExternalFocus,
      });
      if (opener && opener.isConnected) opener.focus();
      setTimeout(() => console.log('[v0] active after restore ->', document.activeElement?.tagName), 0);
    };
    // Mount-only on purpose: see the onCloseRef note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
