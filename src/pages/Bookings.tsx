import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Box, Customer, BookingWithRefs } from '@/lib/database.types'
import {
  formatDate, formatDateRange, formatEuro, isoToday,
  STATUS_LABELS, INVOICE_LABELS, LOGISTICS_LABELS, cn,
} from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge, InvoiceBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Drawer, DrawerSection, DrawerField } from '@/components/ui/Drawer'
import { Input, Select, Textarea } from '@/components/ui/Input'
import type { ToastData } from '@/components/ui/Toast'

type BookingForm = {
  title: string
  customer_id: string
  box_id: string
  location: string
  start_date: string
  end_date: string
  logistics: 'aufbau' | 'abholung'
  media_packages: string
  price_net: string
  status: 'option' | 'bestaetigt' | 'storniert'
  notes: string
}

const emptyForm: BookingForm = {
  title: '',
  customer_id: '',
  box_id: '',
  location: '',
  start_date: isoToday(),
  end_date: isoToday(),
  logistics: 'aufbau',
  media_packages: '1',
  price_net: '',
  status: 'option',
  notes: '',
}

export function Bookings({
  openBooking,
  onClearOpen,
  onToast,
}: {
  openBooking?: BookingWithRefs | null
  onClearOpen?: () => void
  onToast: (t: ToastData) => void
}) {
  const [bookings, setBookings] = useState<BookingWithRefs[]>([])
  const [boxes, setBoxes] = useState<Box[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [drawer, setDrawer] = useState<BookingWithRefs | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<BookingForm>(emptyForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof BookingForm, string>>>({})
  const [saving, setSaving] = useState(false)
  const [mocoLoading, setMocoLoading] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('bookings')
      .select('*, boxes(*), customers(*)')
      .order('start_date', { ascending: false })
    setBookings((data ?? []) as BookingWithRefs[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    supabase.from('boxes').select('*').eq('active', true).then(({ data }) => setBoxes(data ?? []))
    supabase.from('customers').select('*').order('company').then(({ data }) => setCustomers(data ?? []))
  }, [load])

  // Open booking passed from dashboard
  useEffect(() => {
    if (openBooking) {
      setDrawer(openBooking)
      setEditMode(false)
      onClearOpen?.()
    }
  }, [openBooking, onClearOpen])

  const filtered = bookings.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q || b.title.toLowerCase().includes(q)
      || b.customers?.company?.toLowerCase().includes(q)
      || b.location?.toLowerCase().includes(q)
      || b.boxes?.name?.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || b.status === filterStatus
    return matchSearch && matchStatus
  })

  const openNew = () => {
    setForm({ ...emptyForm, start_date: isoToday(), end_date: isoToday() })
    setFormErrors({})
    setEditMode(false)
    setModalOpen(true)
  }

  const openEdit = (b: BookingWithRefs) => {
    setForm({
      title: b.title,
      customer_id: b.customer_id ?? '',
      box_id: b.box_id,
      location: b.location ?? '',
      start_date: b.start_date,
      end_date: b.end_date,
      logistics: b.logistics,
      media_packages: String(b.media_packages),
      price_net: b.price_net != null ? String(b.price_net) : '',
      status: b.status,
      notes: b.notes ?? '',
    })
    setFormErrors({})
    setEditMode(true)
    setModalOpen(true)
  }

  const validate = (): boolean => {
    const errors: Partial<Record<keyof BookingForm, string>> = {}
    if (!form.title.trim()) errors.title = 'Pflichtfeld'
    if (!form.box_id) errors.box_id = 'Bitte eine Box wählen'
    if (!form.start_date) errors.start_date = 'Pflichtfeld'
    if (!form.end_date) errors.end_date = 'Pflichtfeld'
    if (form.end_date < form.start_date) errors.end_date = 'Enddatum vor Startdatum'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const saveBooking = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        customer_id: form.customer_id || null,
        box_id: form.box_id,
        location: form.location || null,
        start_date: form.start_date,
        end_date: form.end_date,
        logistics: form.logistics,
        media_packages: parseInt(form.media_packages) || 1,
        price_net: form.price_net ? parseFloat(form.price_net) : null,
        status: form.status,
        notes: form.notes || null,
      }

      if (editMode && drawer) {
        await supabase.from('bookings').update(payload).eq('id', drawer.id)
      } else {
        await supabase.from('bookings').insert(payload)
      }
      await load()
      setModalOpen(false)
      setDrawer(null)
      onToast({ message: editMode ? 'Buchung aktualisiert' : 'Buchung angelegt', type: 'success' })
    } catch {
      onToast({ message: 'Fehler beim Speichern', type: 'error' })
    }
    setSaving(false)
  }

  const deleteBooking = async (id: string) => {
    if (!confirm('Buchung wirklich löschen?')) return
    await supabase.from('bookings').delete().eq('id', id)
    await load()
    setDrawer(null)
    onToast({ message: 'Buchung gelöscht', type: 'info' })
  }

  const createMocoInvoice = async (bookingId: string) => {
    setMocoLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-moco-invoice', {
        body: { booking_id: bookingId },
      })
      if (error) throw error
      await load()
      const updated = bookings.find(b => b.id === bookingId)
      if (updated) setDrawer({ ...updated, invoice_status: 'entwurf', moco_invoice_id: data?.invoice_id })
      onToast({ message: 'Rechnungsentwurf in MOCO angelegt', type: 'success' })
    } catch (err: unknown) {
      onToast({ message: `MOCO-Fehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`, type: 'error' })
    }
    setMocoLoading(false)
  }

  const sendToAccounting = async (b: BookingWithRefs) => {
    setSendLoading(true)
    try {
      const { error } = await supabase.functions.invoke('send-to-accounting', {
        body: { booking_id: b.id },
      })
      if (error) throw error
      onToast({ message: 'An Buchhaltung gesendet', type: 'success' })
    } catch (err: unknown) {
      onToast({ message: `Fehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`, type: 'error' })
    }
    setSendLoading(false)
  }

  // Reload drawer data from fresh bookings after load
  useEffect(() => {
    if (drawer) {
      const fresh = bookings.find(b => b.id === drawer.id)
      if (fresh) setDrawer(fresh)
    }
  }, [bookings]) // eslint-disable-line react-hooks/exhaustive-deps

  const f = (key: keyof BookingForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suchen nach Anlass, Kunde, Ort…"
          className="flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-gold"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-gold"
        >
          <option value="all">Alle Status</option>
          <option value="option">Option</option>
          <option value="bestaetigt">Bestätigt</option>
          <option value="storniert">Storniert</option>
        </select>
        <Button variant="primary" onClick={openNew}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Neue Buchung
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-hairline overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted text-sm">Lade Buchungen…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-muted text-sm mb-3">
              {search || filterStatus !== 'all'
                ? 'Keine Buchungen gefunden.'
                : 'Noch keine Buchungen – lege die erste an.'}
            </p>
            {!search && filterStatus === 'all' && (
              <Button variant="primary" onClick={openNew} size="sm">Neue Buchung</Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline bg-paper">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Datum</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Anlass</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden md:table-cell">Box</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">Ort</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden md:table-cell">Rechnung</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">Preis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filtered.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => { setDrawer(b); setEditMode(false) }}
                    className="hover:bg-paper cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 tabular-nums text-ink whitespace-nowrap">{formatDateRange(b.start_date, b.end_date)}</td>
                    <td className="px-4 py-3 text-ink max-w-[200px]">
                      <div className="truncate font-medium">{b.title}</div>
                      {b.customers && <div className="text-xs text-muted truncate">{b.customers.company}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted hidden md:table-cell">{b.boxes?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted hidden lg:table-cell max-w-[140px] truncate">{b.location ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><InvoiceBadge status={b.invoice_status} /></td>
                    <td className="px-4 py-3 tabular-nums text-right hidden lg:table-cell font-medium">{formatEuro(b.price_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        title={drawer?.title ?? 'Buchung'}
        footer={
          drawer ? (
            <>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1 justify-center"
                  disabled={drawer.invoice_status !== 'keine'}
                  loading={mocoLoading}
                  onClick={() => createMocoInvoice(drawer.id)}
                >
                  {drawer.invoice_status !== 'keine'
                    ? 'Rechnungsentwurf vorhanden'
                    : 'Rechnung erstellen (MOCO)'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1 justify-center"
                  loading={sendLoading}
                  onClick={() => sendToAccounting(drawer)}
                >
                  An Buchhaltung senden
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => { openEdit(drawer); }}
                >
                  Bearbeiten
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => deleteBooking(drawer.id)}
                  className="text-status-red hover:text-status-red hover:bg-red-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" />
                  </svg>
                </Button>
              </div>
              {drawer.moco_invoice_id && (
                <p className="text-xs text-muted text-center">
                  MOCO-Rechnungs-ID: <span className="tabular-nums font-medium">{drawer.moco_invoice_id}</span>
                </p>
              )}
            </>
          ) : null
        }
      >
        {drawer && (
          <div className="space-y-5">
            <div className="flex gap-2 flex-wrap">
              <StatusBadge status={drawer.status} />
              <InvoiceBadge status={drawer.invoice_status} />
            </div>

            <DrawerSection title="Termin & Box">
              <DrawerField label="Datum" value={formatDateRange(drawer.start_date, drawer.end_date)} />
              <DrawerField label="Box" value={drawer.boxes?.name} />
              <DrawerField label="Ort" value={drawer.location} />
              <DrawerField label="Logistik" value={LOGISTICS_LABELS[drawer.logistics] ?? drawer.logistics} />
            </DrawerSection>

            {drawer.customers && (
              <DrawerSection title="Kunde">
                <DrawerField label="Firma" value={drawer.customers.company} />
                {drawer.customers.contact && <DrawerField label="Kontakt" value={drawer.customers.contact} />}
                {drawer.customers.email && <DrawerField label="E-Mail" value={drawer.customers.email} />}
                {drawer.customers.phone && <DrawerField label="Telefon" value={drawer.customers.phone} />}
              </DrawerSection>
            )}

            <DrawerSection title="Leistung">
              <DrawerField label="Mediapakete" value={`${drawer.media_packages}× (à 400 Fotos)`} />
              <DrawerField label="Preis (Netto)" value={formatEuro(drawer.price_net)} />
            </DrawerSection>

            {drawer.notes && (
              <DrawerSection title="Notizen">
                <p className="text-sm text-ink whitespace-pre-wrap">{drawer.notes}</p>
              </DrawerSection>
            )}

            <DrawerSection title="Intern">
              <DrawerField label="Angelegt" value={formatDate(drawer.created_at.slice(0, 10))} />
              <DrawerField label="ID" value={<span className="text-xs font-mono">{drawer.id.slice(0, 8)}…</span>} />
            </DrawerSection>
          </div>
        )}
      </Drawer>

      {/* New/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editMode ? 'Buchung bearbeiten' : 'Neue Buchung'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Abbrechen</Button>
            <Button variant="primary" loading={saving} onClick={saveBooking}>
              {editMode ? 'Speichern' : 'Buchung anlegen'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Anlass *"
            value={form.title}
            onChange={e => f('title', e.target.value)}
            placeholder="z. B. Hochzeit Müller"
            error={formErrors.title}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Box *"
              value={form.box_id}
              onChange={e => f('box_id', e.target.value)}
              options={[
                { value: '', label: '— Box wählen —' },
                ...boxes.map(b => ({ value: b.id, label: b.name })),
              ]}
              error={formErrors.box_id}
            />
            <Select
              label="Kunde"
              value={form.customer_id}
              onChange={e => f('customer_id', e.target.value)}
              options={[
                { value: '', label: '— Kein Kunde —' },
                ...customers.map(c => ({ value: c.id, label: c.company })),
              ]}
            />
          </div>
          <Input
            label="Veranstaltungsort"
            value={form.location}
            onChange={e => f('location', e.target.value)}
            placeholder="z. B. Schloss Ehreshoven, Engelskirchen"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Von *"
              type="date"
              value={form.start_date}
              onChange={e => {
                f('start_date', e.target.value)
                if (e.target.value > form.end_date) f('end_date', e.target.value)
              }}
              error={formErrors.start_date}
            />
            <Input
              label="Bis *"
              type="date"
              value={form.end_date}
              onChange={e => f('end_date', e.target.value)}
              error={formErrors.end_date}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Logistik"
              value={form.logistics}
              onChange={e => f('logistics', e.target.value as 'aufbau' | 'abholung')}
              options={[
                { value: 'aufbau', label: 'Auf-/Abbau (wir)' },
                { value: 'abholung', label: 'Abholung (Kunde)' },
              ]}
            />
            <Input
              label="Mediapakete (à 400 Fotos)"
              type="number"
              min="1"
              value={form.media_packages}
              onChange={e => f('media_packages', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Preis Netto (€)"
              type="number"
              step="0.01"
              min="0"
              value={form.price_net}
              onChange={e => f('price_net', e.target.value)}
              placeholder="0,00"
            />
            <Select
              label="Status"
              value={form.status}
              onChange={e => f('status', e.target.value as BookingForm['status'])}
              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <Textarea
            label="Notizen"
            value={form.notes}
            onChange={e => f('notes', e.target.value)}
            placeholder="Interne Hinweise, Besonderheiten…"
          />
        </div>
      </Modal>
    </div>
  )
}
