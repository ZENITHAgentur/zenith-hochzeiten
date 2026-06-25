import { cn } from '@/lib/utils'

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  hint?: string
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  error?: string
}

const fieldBase = 'w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-gold focus:border-gold transition-colors'

export function Input({ label, error, hint, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-muted uppercase tracking-wide">{label}</label>}
      <input className={cn(fieldBase, error && 'border-status-red focus:ring-status-red', className)} {...props} />
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-status-red">{error}</p>}
    </div>
  )
}

export function Select({ label, error, options, className, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-muted uppercase tracking-wide">{label}</label>}
      <select className={cn(fieldBase, 'cursor-pointer', error && 'border-status-red', className)} {...props}>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-status-red">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-muted uppercase tracking-wide">{label}</label>}
      <textarea
        rows={3}
        className={cn(fieldBase, 'resize-vertical', error && 'border-status-red', className)}
        {...props}
      />
      {error && <p className="text-xs text-status-red">{error}</p>}
    </div>
  )
}
