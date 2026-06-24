import { cn } from '@/lib/utils'

type Variant = 'green' | 'gold' | 'red' | 'muted' | 'blue'

const variantClasses: Record<Variant, string> = {
  green: 'bg-green-100 text-status-green border border-green-200',
  gold:  'bg-amber-50 text-amber-700 border border-amber-200',
  red:   'bg-red-50 text-status-red border border-red-200',
  muted: 'bg-gray-100 text-muted border border-hairline',
  blue:  'bg-blue-50 text-blue-700 border border-blue-200',
}

export function Badge({ children, variant = 'muted', className }: {
  children: React.ReactNode
  variant?: Variant
  className?: string
}) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tabular-nums whitespace-nowrap',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: Variant }> = {
    option:     { label: 'Option',      variant: 'gold'  },
    bestaetigt: { label: 'Bestätigt',   variant: 'green' },
    storniert:  { label: 'Storniert',   variant: 'red'   },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'muted' }
  return <Badge variant={variant}>{label}</Badge>
}

export function InvoiceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: Variant }> = {
    keine:    { label: 'Keine Rechnung', variant: 'muted' },
    entwurf:  { label: 'Entwurf',        variant: 'blue'  },
    bezahlt:  { label: 'Bezahlt',        variant: 'green' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'muted' }
  return <Badge variant={variant}>{label}</Badge>
}
