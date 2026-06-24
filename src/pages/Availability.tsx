import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Box, BookingWithRefs } from '@/lib/database.types'
import { isoToday, addDays, dateRange, formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { ToastData } from '@/components/ui/Toast'

type AvailResult = { box: Box; free: boolean }

function checkOverlap(bookings: BookingWithRefs[], boxId: string, von: string, bis: string): boolean {
  return bookings.some(
    b => b.box_id === boxId && b.status !== 'storniert' && b.start_date <= bis && von <= b.end_date
  )
}

export function Availability({ onToast }: { onToast: (t: ToastData) => void }) {
  const [von, setVon] = useState(isoToday())
  const [bis, setBis] = useState(isoToday())
  const [boxes, setBoxes] = useState<Box[]>([])
  const [bookings, setBookings] = useState<BookingWithRefs[]>([])
  const [results, setResults] = useState<AvailResult[] | null>(null)
  const [checking, setChecking] = useState(false)

  // Block modal
  const [blockModal, setBlockModal] = useState(false)
  const [blockBox, setBlockBox] = useState<Box | null>(null)
  const [blockTitle, setBlockTitle] = useState('')
  const [blockLogistics, setBlockLogistics] = useState<'aufbau' | 'abholung'>('aufbau')
  const [blocking, setBlocking] = useState(false)

  // Timeline window
  const timelineStart = isoToday()
  const timelineDays = 42 // 6 weeks

  useEffect(() => {
    supabase.from('boxes').select('*').eq('active', true).then(({ data }) => setBoxes(data ?? []))
    supabase
      .from('bookings')
      .select('*, boxes(*), customers(*)')
      .neq('status', 'storniert')
      .gte('end_date', isoToday())
      .then(({ data }) => setBookings((data ?? []) as BookingWithRefs[]))
  }, [])

  const checkAvailability = () => {
    if (!von || !bis || bis < von) return
    setChecking(true)
    const res: AvailResult[] = boxes.map(box => ({
      box,
      free: !checkOverlap(bookings, box.id, von, bis),
    }))
    setResults(res)
    setChecking(false)
  }

  const openBlock = (box: Box) => {
    setBlockBox(box)
    setBlockTitle('')
    setBlockLogistics('aufbau')
    setBlockModal(true)
  }

  const confirmBlock = async () => {
    if (!blockBox || !blockTitle.trim()) return
    setBlocking(true)
    try {
      await supabase.from('bookings').insert({
        box_id: blockBox.id,
        title: blockTitle.trim(),
        start_date: von,
        end_date: bis,
        logistics: blockLogistics,
        status: 'option',
        media_packages: 1,
      })
      // Refresh bookings
      const { data } = await supabase
        .from('bookings')
        .select('*, boxes(*), customers(*)')
        .neq('status', 'storniert')
        .gte('end_date', isoToday())
      setBookings((data ?? []) as BookingWithRefs[])
      // Re-check
      const res: AvailResult[] = boxes.map(box => ({
        box,
        free: !checkOverlap((data ?? []) as BookingWithRefs[], box.id, von, bis),
      }))
      setResults(res)
      setBlockModal(false)
      onToast({ message: `${blockBox.name} als Option geblockt`, type: 'success' })
    } catch {
      onToast({ message: 'Fehler beim Anlegen der Option', type: 'error' })
    }
    setBlocking(false)
  }

  // Timeline: 6 weeks of days
  const timelineDayList = dateRange(timelineStart, addDays(timelineStart, timelineDays - 1))

  // Group timeline days by week for column headers
  const weekLabels = timelineDayList.reduce<{ label: string; count: number }[]>((acc, d) => {
    const date = new Date(d)
    const kw = getISOWeek(date)
    const year = date.getFullYear()
    const label = `KW ${kw}`
    if (!acc.length || acc[acc.length - 1].label !== label) {
      acc.push({ label, count: 1 })
    } else {
      acc[acc.length - 1].count++
    }
    return acc
  }, [])

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Date picker */}
      <div className="bg-white rounded-xl border border-hairline p-5">
        <h2 className="text-sm font-semibold text-ink mb-4">Zeitraum prüfen</h2>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <Input
            label="Von"
            type="date"
            value={von}
            onChange={e => { setVon(e.target.value); setResults(null) }}
            className="w-full sm:w-auto"
          />
          <Input
            label="Bis"
            type="date"
            value={bis}
            min={von}
            onChange={e => { setBis(e.target.value); setResults(null) }}
            className="w-full sm:w-auto"
          />
          <Button
            variant="primary"
            onClick={checkAvailability}
            loading={checking}
            disabled={!von || !bis || bis < von}
          >
            Verfügbarkeit prüfen
          </Button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-white rounded-xl border border-hairline overflow-hidden">
          <div className="px-5 py-3 border-b border-hairline bg-paper">
            <p className="text-xs text-muted">
              Ergebnis für <strong className="text-ink">{formatDate(von)}</strong>
              {von !== bis && <> – <strong className="text-ink">{formatDate(bis)}</strong></>}
            </p>
          </div>
          <div className="divide-y divide-hairline">
            {results.map(({ box, free }) => (
              <div key={box.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-sm text-ink">{box.name}</p>
                  {box.subtitle && <p className="text-xs text-muted">{box.subtitle}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 text-sm font-medium',
                    free ? 'text-status-green' : 'text-status-red'
                  )}>
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      free ? 'bg-status-green' : 'bg-status-red'
                    )} />
                    {free ? 'Frei' : 'Belegt'}
                  </span>
                  {free && (
                    <Button variant="primary" size="sm" onClick={() => openBlock(box)}>
                      Blocken
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Belegungs-Timeline */}
      <section>
        <h2 className="text-sm font-semibold text-ink mb-3">Belegungsübersicht – nächste 6 Wochen</h2>
        <div className="bg-white rounded-xl border border-hairline overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="text-xs border-collapse min-w-max">
              <thead>
                {/* Week headers */}
                <tr className="bg-paper border-b border-hairline">
                  <th className="sticky left-0 z-10 bg-paper px-4 py-2 text-left font-medium text-muted w-32 border-r border-hairline">Box</th>
                  {weekLabels.map((w, i) => (
                    <th
                      key={i}
                      colSpan={w.count}
                      className="px-1 py-2 text-center font-medium text-muted border-r border-hairline/50"
                    >
                      {w.label}
                    </th>
                  ))}
                </tr>
                {/* Day headers */}
                <tr className="bg-paper border-b border-hairline">
                  <th className="sticky left-0 z-10 bg-paper border-r border-hairline" />
                  {timelineDayList.map(d => {
                    const date = new Date(d)
                    const isToday = d === isoToday()
                    const dayName = date.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)
                    const dayNum = date.getDate()
                    return (
                      <th
                        key={d}
                        className={cn(
                          'px-0 py-1 text-center font-normal w-8',
                          isToday ? 'bg-gold/10 text-gold font-bold' : 'text-muted'
                        )}
                      >
                        <div>{dayName}</div>
                        <div className={isToday ? 'text-gold font-bold' : ''}>{dayNum}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {boxes.map(box => (
                  <tr key={box.id} className="group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-paper px-4 py-2 font-medium text-ink border-r border-hairline whitespace-nowrap transition-colors">
                      {box.name}
                    </td>
                    {timelineDayList.map(d => {
                      const booking = bookings.find(
                        b => b.box_id === box.id && b.start_date <= d && d <= b.end_date
                      )
                      const isToday = d === isoToday()
                      const isStart = booking?.start_date === d
                      const isEnd = booking?.end_date === d

                      return (
                        <td
                          key={d}
                          title={booking ? `${booking.title} (${booking.status})` : undefined}
                          className={cn(
                            'h-9 w-8 border-r border-hairline/30 transition-colors',
                            isToday && !booking && 'bg-gold/5',
                            !booking && 'bg-white group-hover:bg-paper/50',
                            booking && booking.status === 'option' && 'bg-amber-100',
                            booking && booking.status === 'bestaetigt' && 'bg-green-100',
                          )}
                        >
                          {booking && isStart && (
                            <div className={cn(
                              'h-full flex items-center px-1 text-[10px] font-medium truncate leading-tight',
                              booking.status === 'option' ? 'text-amber-800' : 'text-green-800'
                            )}>
                              {isStart && !isEnd ? `${box.name.slice(0, 3)}…` : ''}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-3 border-t border-hairline bg-paper">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-200" />
              <span className="text-xs text-muted">Option</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
              <span className="text-xs text-muted">Bestätigt</span>
            </div>
          </div>
        </div>
      </section>

      {/* Block Modal */}
      <Modal
        open={blockModal}
        onClose={() => setBlockModal(false)}
        title={`${blockBox?.name} blocken`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBlockModal(false)}>Abbrechen</Button>
            <Button
              variant="primary"
              loading={blocking}
              disabled={!blockTitle.trim()}
              onClick={confirmBlock}
            >
              Als Option anlegen
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Zeitraum: <strong className="text-ink">{formatDate(von)}</strong>
            {von !== bis && <> – <strong className="text-ink">{formatDate(bis)}</strong></>}
          </p>
          <Input
            label="Anlass / Titel *"
            value={blockTitle}
            onChange={e => setBlockTitle(e.target.value)}
            placeholder="z. B. Hochzeit Mustermann"
            autoFocus
          />
          <Select
            label="Logistik"
            value={blockLogistics}
            onChange={e => setBlockLogistics(e.target.value as 'aufbau' | 'abholung')}
            options={[
              { value: 'aufbau', label: 'Auf-/Abbau (wir)' },
              { value: 'abholung', label: 'Abholung (Kunde)' },
            ]}
          />
        </div>
      </Modal>
    </div>
  )
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
