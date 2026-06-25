import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variantClasses: Record<Variant, string> = {
  primary:   'bg-gold text-ink font-semibold hover:bg-amber-600 focus-visible:ring-gold',
  secondary: 'bg-white border border-hairline text-ink hover:bg-paper focus-visible:ring-gold',
  ghost:     'text-muted hover:bg-hairline focus-visible:ring-gold',
  danger:    'bg-status-red text-white hover:bg-red-800 focus-visible:ring-red-400',
}

export function Button({
  children,
  variant = 'secondary',
  className,
  disabled,
  loading,
  type = 'button',
  onClick,
  size = 'md',
}: {
  children: React.ReactNode
  variant?: Variant
  className?: string
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
  size?: 'sm' | 'md'
}) {
  const sizeClasses = size === 'sm'
    ? 'px-3 py-1.5 text-sm'
    : 'px-4 py-2 text-sm'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClasses,
        variantClasses[variant],
        className
      )}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
