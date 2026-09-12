'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Confirmation dialog.
 *
 * Replaces `window.confirm()`: a native popup cannot be styled, stops the whole
 * browser, and gives no room to explain what is about to happen. This is a real
 * element instead — dismissible with Escape or a click outside, readable by
 * screen readers, and reusable for any later destructive action.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Disables both buttons and relabels the confirm button while work is in flight. */
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Focus the safe action, not the destructive one: a stray Enter should
    // cancel rather than delete.
    cancelRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;

      // Keep Tab inside the dialog while it is modal.
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, [tabindex]');
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog" role="presentation" onClick={onCancel}>
      <div
        ref={panelRef}
        className="dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        {children && <div className="dialog__body">{children}</div>}

        <div className="dialog__actions">
          <button ref={cancelRef} className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
