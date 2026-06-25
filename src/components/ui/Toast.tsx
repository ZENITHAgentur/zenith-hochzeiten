import { useEffect } from 'react'

export type ToastData = {
  message: string
  type: 'success' | 'error' | 'info'
}

export function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [toast, onClose])

  const colors = {
    success: 'bg-status-green text-white',
    error:   'bg-status-red text-white',
    info:    'bg-ink text-white',
  }

  return (
    <div
      role="alert"
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl
        text-sm font-medium min-w-[280px] max-w-sm
        animate-in fade-in slide-in-from-bottom-2 duration-200
        ${colors[toast.type]}
      `}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onClose}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Schließen"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
