import { cn } from '@/lib/utils'

export type Page = 'dashboard' | 'availability' | 'bookings'

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Übersicht',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    id: 'availability',
    label: 'Verfügbarkeit',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'bookings',
    label: 'Buchungen',
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" strokeLinecap="round" />
      </svg>
    ),
  },
]

export function Sidebar({
  page,
  onNavigate,
  onSignOut,
}: {
  page: Page
  onNavigate: (p: Page) => void
  onSignOut: () => void
}) {
  return (
    <aside className="w-16 lg:w-56 bg-ink flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center justify-center lg:justify-start lg:px-5 border-b border-white/10">
        <span className="text-gold font-bold text-lg tracking-widest hidden lg:block">ZENITH</span>
        <span className="text-gold font-bold text-base lg:hidden">Z</span>
        <span className="text-white/40 text-xs ml-2 hidden lg:block">Fotobox</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2 lg:px-3" aria-label="Hauptnavigation">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-2 lg:px-3 py-2.5 text-sm transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset',
              'justify-center lg:justify-start',
              page === item.id
                ? 'bg-gold/20 text-gold font-medium'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            )}
          >
            {item.icon}
            <span className="hidden lg:block">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-2 lg:px-3 pb-4">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 rounded-lg px-2 lg:px-3 py-2.5 text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors justify-center lg:justify-start focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden lg:block">Abmelden</span>
        </button>
      </div>
    </aside>
  )
}
