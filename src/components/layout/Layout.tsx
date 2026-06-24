import { Sidebar, type Page } from './Sidebar'

export function Layout({
  page,
  onNavigate,
  onSignOut,
  headerRight,
  children,
}: {
  page: Page
  onNavigate: (p: Page) => void
  onSignOut: () => void
  headerRight?: React.ReactNode
  children: React.ReactNode
}) {
  const titles: Record<Page, string> = {
    dashboard:    'Übersicht',
    availability: 'Verfügbarkeit',
    bookings:     'Buchungen',
    customers:    'Kunden',
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar page={page} onNavigate={onNavigate} onSignOut={onSignOut} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-hairline flex items-center justify-between px-6 shrink-0">
          <h1 className="font-semibold text-base text-ink">{titles[page]}</h1>
          <div className="flex items-center gap-3">{headerRight}</div>
        </header>
        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-paper scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  )
}
