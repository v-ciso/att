'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    // Focus the first real control so the user lands on something actionable,
    // falling back to the container itself when the dialog is text-only.
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
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
      // back at the top of the document.
      opener?.focus?.();
    };
  }, [onClose]);

  return ref;
}
