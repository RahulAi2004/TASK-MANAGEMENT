import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-md' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-6" onClick={onClose}>
      <div
        className={`w-full ${width} rounded-card border border-border bg-surface shadow-pop`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">{title}</h3>
            {subtitle && <p className="text-xs text-ink-secondary">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="focus-ring grid h-8 w-8 place-items-center rounded-control text-ink-tertiary hover:bg-subtle">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export const modalInput =
  'focus-ring w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-tertiary'

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-control bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-pop">
        {toast}
      </div>
    </div>
  )
}
