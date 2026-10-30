import React from 'react'
import { ModalPresence, CloseButton } from './Modal.jsx'

export function ConfirmationDialog({
  open,
  label,
  title,
  eyebrow,
  description,
  children,
  className = '',
  busy = false,
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel = 'Cancel',
  cancelClassName = '',
}) {
  const close = () => {
    if (!busy) onClose()
  }
  return (
    <ModalPresence open={open} label={label || title}>
      <div className="modal-backdrop">
        <div className={`modal sheet small-sheet ${className}`}>
          <div className="modal-header">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h2>{title}</h2>
            </div>
            <CloseButton disabled={busy} onClick={close} />
          </div>
          <p className="modal-copy">{description}</p>
          {children}
          <div className="modal-actions">
            <button
              type="button"
              className={`button secondary ${cancelClassName}`}
              disabled={busy}
              onClick={close}
            >
              {cancelLabel}
            </button>
            <button type="button" className="button danger" disabled={busy} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPresence>
  )
}
