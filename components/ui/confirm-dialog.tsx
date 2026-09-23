'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './modal';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs on confirm. May be async — the button shows a spinner until it settles. */
  onConfirm: () => void | Promise<void>;
  title: string;
  /** Say plainly what will happen and what will NOT be touched. */
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + warning icon, for anything that destroys data. */
  destructive?: boolean;
  /**
   * When set, the user must type this exact text to enable the confirm button.
   * Reserve it for irreversible, wide-blast-radius actions (deleting a company).
   */
  requireTypedConfirmation?: string;
  /** Single-button acknowledgement (e.g. an error notice), no Cancel shown. */
  hideCancel?: boolean;
}

/**
 * The app's single confirmation primitive.
 *
 * This replaces the "click again to confirm" pattern that was used for
 * destructive actions. That pattern is a genuine accessibility failure: the
 * button's accessible name changes under the user, a 4-second timeout silently
 * cancels intent (WCAG 2.2.1 Timing Adjustable), and a screen-reader user gets
 * no warning that the second press wipes data. A real dialog states the
 * consequence, is dismissible with Escape, and traps focus (see ./modal.tsx).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  requireTypedConfirmation,
  hideCancel = false,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Reset the gate each time the dialog opens, so a previous attempt can't
  // leave the confirm button pre-armed.
  useEffect(() => {
    if (open) {
      setTyped('');
      setBusy(false);
    }
  }, [open]);

  const gateSatisfied =
    !requireTypedConfirmation || typed.trim() === requireTypedConfirmation;

  const handleConfirm = async () => {
    if (!gateSatisfied || busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => !busy && onOpenChange(false)}
      size="sm"
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        {destructive && (
          <span
            className="flex-none mt-0.5 w-9 h-9 rounded-full bg-accent-red/15 flex items-center justify-center"
            aria-hidden="true"
          >
            <AlertTriangle className="w-5 h-5 text-accent-red" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white text-pretty">{title}</h2>
          <p className="mt-1.5 text-sm text-text-secondary leading-relaxed text-pretty">
            {description}
          </p>
        </div>
      </div>

      {requireTypedConfirmation && (
        <div className="mt-4">
          <label htmlFor="confirm-gate" className="block text-sm text-text-secondary">
            {'Type '}
            <span className="font-mono font-semibold text-white">{requireTypedConfirmation}</span>
            {' to continue'}
          </label>
          <input
            id="confirm-gate"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => {
              // Don't submit mid-IME-composition (CJK keyboards confirm with Enter).
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                void handleConfirm();
              }
            }}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="confirm-gate-hint"
            className="mt-2 w-full px-3 py-2 min-h-11 rounded-lg bg-white/5 border border-border-subtle text-white placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          />
          <p id="confirm-gate-hint" className="mt-1.5 text-xs text-text-muted">
            This is required because the action cannot be undone.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        {!hideCancel && (
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="min-h-11"
          >
            {cancelLabel}
          </Button>
        )}
        <Button
          ref={confirmRef}
          variant={destructive ? 'danger' : 'primary'}
          onClick={handleConfirm}
          disabled={!gateSatisfied}
          loading={busy}
          className="min-h-11"
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
