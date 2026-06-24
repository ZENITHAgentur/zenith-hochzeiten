import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { BookingWithRefs } from '@/lib/database.types'
import { formatDate, formatDateRange, formatEuro, daysUntil, isoToday } from '@/lib/utils'
import { StatusBadge, InvoiceBadge } from '@/components/ui/Badge'

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-hairline p-5">
      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-ink tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

export function Dashboard({ onOpenBooking }: { onOpenBooking: (b: BookingWithRefs) => void }) {
  const [bookings, setBookings] = useState<BookingWithRefs[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('bookings')
      .select('*, boxes(*), customers(*)')
      .neq('status', 'storniert')
      .order('start_date', { ascending: true })
      .then(({ data }) => {
        setBookings((data ?? []) as BookingWithRefs[])
        setLoading(false)
      })
  }, [])

  const today = isoToday()
  const thisYear = today.slice(0, 4)

  const yearBookings = bookings.filter(b => b.start_date.startsWith(thisYear))
  const upcoming = bookings.filter(b => b.end_date >= today).slice(0, 8)
  const pendingHandover = bookings.filter(
    b => b.status === 'bestaetigt' && b.invoice_status === 'keine'
  )

  const totalRevenue = yearBookings.reduce((sum, b) => sum + (b.price_net ?? 0), 0)

  const confirmedCount = yearBookings.filter(b => b.status === 'bestaetigt').length

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-xl border border-hairline animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={`Buchungen ${thisYear}`}
          value={yearBookings.length}
          sub={`${confirmedCount} bestätigt`}
        />
        <KpiCard
          label={`Umsatz ${thisYear}`}
          value={formatEuro(totalRevenue)}
          sub="Netto, bestätigt + Option"
        />
        <KpiCard
          label="Nächste Einsätze"
          value={upcoming.length}
          sub="ab heute"
        />
        <KpiCard
          label="Offene Übergaben"
          value={pendingHandover.length}
          sub="bestätigt, noch keine Rechnung"
        />
      </div>

      {/* Nächste Einsätze */}
      <section>
        <h2 className="text-sm font-semibold text-ink mb-3">Nächste Einsätze</h2>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl border border-hairline p-8 text-center text-muted text-sm">
            Keine bevorstehenden Buchungen – lege die erste an.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-hairline overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-paper">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Termin</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Anlass</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden md:table-cell">Box</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">Ort</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden md:table-cell">In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {upcoming.map(b => {
                  const days = daysUntil(b.start_date)
                  return (
                    <tr
                      key={b.id}
                      onClick={() => onOpenBooking(b)}
                      className="hover:bg-paper cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 tabular-nums text-ink font-medium whitespace-nowrap">
                        {formatDateRange(b.start_date, b.end_date)}
                      </td>
                      <td className="px-4 py-3 text-ink max-w-[180px] truncate">
                        {b.title}
                        {b.customers && (
                          <span className="text-muted ml-1 text-xs">· {b.customers.company}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted hidden md:table-cell">{b.boxes?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-muted hidden lg:table-cell max-w-[160px] truncate">{b.location ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3 tabular-nums text-right text-muted hidden md:table-cell">
                        {days === 0 ? (
                          <span className="text-status-green font-semibold">Heute</span>
                        ) : days === 1 ? (
                          <span className="text-gold font-semibold">Morgen</span>
                        ) : days < 0 ? (
                          <span className="text-muted">läuft</span>
                        ) : (
                          <span>{days} Tage</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Offene Übergaben */}
      {pendingHandover.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-ink mb-3">
            Offene Übergaben an Buchhaltung
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">{pendingHandover.length}</span>
          </h2>
          <div className="bg-white rounded-xl border border-hairline overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-hairline">
                {pendingHandover.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => onOpenBooking(b)}
                    className="hover:bg-paper cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 tabular-nums text-ink whitespace-nowrap">{formatDate(b.start_date)}</td>
                    <td className="px-4 py-3 text-ink">{b.title}</td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">{b.boxes?.name}</td>
                    <td className="px-4 py-3 tabular-nums text-ink font-medium text-right">{formatEuro(b.price_net)}</td>
                    <td className="px-4 py-3"><InvoiceBadge status={b.invoice_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
