'use client'
import { useEffect, useRef } from 'react'

interface BottomSheetProps {
  open:     boolean
  title:    string
  onClose:  () => void
  children: React.ReactNode
  footer?:  React.ReactNode
}

// An editing panel that slides up from the bottom on phones and shows as a
// centred card on desktop. Built on the native <dialog>, which gives focus
// trapping, Escape-to-close and an inert page behind it for free.
export default function BottomSheet({ open, title, onClose, children, footer }: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onCancel={e => { e.preventDefault(); onClose() }}
      // A tap on the backdrop lands on the <dialog> element itself.
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {open && (
        <>
          <div className="sheet-head">
            <div className="sheet-title">{title}</div>
            <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">×</button>
          </div>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </>
      )}
    </dialog>
  )
}
