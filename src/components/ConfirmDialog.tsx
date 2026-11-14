import { useId } from 'react'
import type { ReactNode, RefObject } from 'react'

export function ConfirmDialog({ dialogRef, title, description, cancelLabel, confirmLabel, onConfirm, children }: {
  dialogRef: RefObject<HTMLDialogElement | null>
  title: string
  description: string
  cancelLabel: string
  confirmLabel: string
  onConfirm: () => void
  children?: ReactNode
}) {
  const titleId = useId()
  const descriptionId = useId()
  return (
    <dialog ref={dialogRef} className="confirm-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
      {children}
      <div className="confirm-actions">
        <button type="button" className="button" onClick={() => dialogRef.current?.close()}>{cancelLabel}</button>
        <button type="button" className="button primary-button" onClick={() => {
          dialogRef.current?.close()
          onConfirm()
        }}>{confirmLabel}</button>
      </div>
    </dialog>
  )
}
