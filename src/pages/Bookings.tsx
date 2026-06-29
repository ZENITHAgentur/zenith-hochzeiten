import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Box, BookingWithRefs } from '@/lib/database.types'
import {
  formatDate, formatEuro, isoToday,
  STATUS_LABELS, INVOICE_LABELS, cn,
} from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { StatusBadge, InvoiceBadge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Drawer, DrawerSection, DrawerField } from '@/components/ui/Drawer'
import { Input, Select, Textarea } from '@/components/ui/Input'
import type { ToastData } from '@/components/ui/Toast'

const BASE_PRICE_MIT_DRUCKER = 300
const BASE_PRICE_OHNE_DRUCKER = 200

type BookingForm = {
  title: string
  billing_company: string
  billing_address: string
  location: string
  aufbaudatum: string
  event_date: string
  with_printer: boolean
  setup_cost: string
  status: 'option' | 'bestaetigt' | 'storniert'
  notes: string
}

const emptyForm: BookingForm = {
  title: '',
  billing_company: '',
  billing_address: '',
  location: '',
  aufbaudatum: '',
  event_date: isoToday(),
  with_printer: true,
  setup_cost: '',
  status: 'option',
  notes: '',
}

function calcTotal(form: BookingForm): number {
  const base = form.with_printer ? BASE_PRICE_MIT_DRUCKER : BASE_PRICE_OHNE_DRUCKER
  return base + (parseFloat(form.setup_cost) || 0)
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
  const [defaultBox, setDefaultBox] = useState<Box | null>(null)
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
      .select('*, boxes(*)')
      .order('end_date', { ascending: false })
    setBookings((data ?? []) as BookingWithRefs[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    supabase.from('boxes').select('*').eq('active', true).limit(1).single()
      .then(({ data }) => setDefaultBox(data))
  }, [load])

  useEffect(() => {
    if (openBooking) {
      setDrawer(openBooking)
      setEditMode(false)
      onClearOpen?.()
    }
  }, [openBooking, onClearOpen])

  const filtered = bookings.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q
      || b.title.toLowerCase().includes(q)
      || b.billing_company?.toLowerCase().includes(q)
      || b.location?.toLowerCase().includes(q)
    const matchStatus = filterStatus === 'all' || b.status === filterStatus
    return matchSearch && matchStatus
  })

  const openNew = () => {
    setForm({ ...emptyForm, event_date: isoToday() })
    setFormErrors({})
    setEditMode(false)
    setModalOpen(true)
  }

  const openEdit = (b: BookingWithRefs) => {
    const hasAufbau = b.start_date !== b.end_date
    setForm({
      title: b.title,
      billing_company: b.billing_company ?? '',
      billing_address: b.billing_address ?? '',
      location: b.location ?? '',
      aufbaudatum: hasAufbau ? b.start_date : '',
      event_date: b.end_date,
      with_printer: b.with_printer ?? true,
      setup_cost: b.setup_cost != null ? String(b.setup_cost) : '',
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
    if (!form.event_date) errors.event_date = 'Pflichtfeld'
    if (form.aufbaudatum && form.aufbaudatum > form.event_date)
      errors.aufbaudatum = 'Aufbaudatum muss vor dem Veranstaltungstag liegen'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const saveBooking = async () => {
    if (!validate()) return
    if (!defaultBox) {
      onToast({ message: 'Keine aktive Fotobox gefunden', type: 'error' })
      return
    }
    setSaving(true)
    try {
      const hasAufbau = !!form.aufbaudatum && form.aufbaudatum !== form.event_date
      const payload = {
        title: form.title.trim(),
        box_id: defaultBox.id,
        billing_company: form.billing_company || null,
        billing_address: form.billing_address || null,
        location: form.location || null,
        start_date: hasAufbau ? form.aufbaudatum : form.event_date,
        end_date: form.event_date,
        logistics: hasAufbau ? ('aufbau' as const) : ('abholung' as const),
        with_printer: form.with_printer,
        setup_cost: parseFloat(form.setup_cost) || null,
        media_packages: 1,
        price_net: calcTotal(form),
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

  useEffect(() => {
    if (drawer) {
      const fresh = bookings.find(b => b.id === drawer.id)
      if (fresh) setDrawer(fresh)
    }
  }, [bookings]) // eslint-disable-line react-hooks/exhaustive-deps

  const f = (key: keyof BookingForm, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const drawerHasAufbau = drawer ? drawer.start_date !== drawer.end_date : false

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suchen nach Anlass, Auftraggeber, Ort…"
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Veranstaltungstag</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Anlass</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">Ort</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden md:table-cell">Rechnung</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">Gesamt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filtered.map(b => (
                  <tr
                    key={b.id}
                    onClick={() => { setDrawer(b); setEditMode(false) }}
                    className="hover:bg-paper cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 tabular-nums text-ink whitespace-nowrap">{formatDate(b.end_date)}</td>
                    <td className="px-4 py-3 text-ink max-w-[200px]">
                      <div className="truncate font-medium">{b.title}</div>
                      {b.billing_company && (
                        <div className="text-xs text-muted truncate">{b.billing_company}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted hidden lg:table-cell max-w-[140px] truncate">{b.location ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><InvoiceBadge status={b.invoice_status} /></td>
                    <td className="px-4 py-3 tabular-nums text-right hidden lg:table-cell font-medium">
                      {formatEuro(b.price_net)}
                    </td>
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
                <Button variant="secondary" onClick={() => openEdit(drawer)}>
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

            <DrawerSection title="Termin">
              {drawerHasAufbau && (
                <DrawerField label="Aufbaudatum" value={formatDate(drawer.start_date)} />
              )}
              <DrawerField label="Veranstaltungstag" value={formatDate(drawer.end_date)} />
              {drawer.location && <DrawerField label="Ort" value={drawer.location} />}
            </DrawerSection>

            {(drawer.billing_company || drawer.billing_address) && (
              <DrawerSection title="Auftraggeber">
                {drawer.billing_company && <DrawerField label="Firma" value={drawer.billing_company} />}
                {drawer.billing_address && <DrawerField label="Adresse" value={drawer.billing_address} />}
              </DrawerSection>
            )}

            <DrawerSection title="Leistung">
              <DrawerField
                label="Paket"
                value={drawer.with_printer
                  ? 'Mit Drucker · inkl. 400 Fotos + Mediapaket'
                  : 'Ohne Drucker · inkl. 400 Fotos + Mediapaket'}
              />
              <DrawerField
                label="Basispreis"
                value={formatEuro(drawer.with_printer ? BASE_PRICE_MIT_DRUCKER : BASE_PRICE_OHNE_DRUCKER)}
              />
              {drawer.setup_cost != null && drawer.setup_cost > 0 && (
                <DrawerField label="Aufbaukosten" value={formatEuro(drawer.setup_cost)} />
              )}
              <DrawerField
                label="Gesamt (brutto)"
                value={
                  <span className="font-semibold text-ink">{formatEuro(drawer.price_net)}</span>
                }
              />
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
          {/* Anlass */}
          <Input
            label="Anlass *"
            value={form.title}
            onChange={e => f('title', e.target.value)}
            placeholder="z. B. Hochzeit Müller"
            error={formErrors.title}
          />

          {/* Auftraggeber */}
          <Input
            label="Firma / Rechnungsempfänger"
            value={form.billing_company}
            onChange={e => f('billing_company', e.target.value)}
            placeholder="z. B. Muster GmbH oder Max Mustermann"
          />
          <Textarea
            label="Rechnungsadresse"
            value={form.billing_address}
            onChange={e => f('billing_address', e.target.value)}
            placeholder={'Musterstraße 1\n12345 Musterstadt'}
            rows={3}
          />

          {/* Ort */}
          <Input
            label="Veranstaltungsort"
            value={form.location}
            onChange={e => f('location', e.target.value)}
            placeholder="z. B. Schloss Ehreshoven, Engelskirchen"
          />

          {/* Datum */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Aufbaudatum (optional)"
              type="date"
              value={form.aufbaudatum}
              onChange={e => f('aufbaudatum', e.target.value)}
              error={formErrors.aufbaudatum}
            />
            <Input
              label="Veranstaltungstag *"
              type="date"
              value={form.event_date}
              onChange={e => f('event_date', e.target.value)}
              error={formErrors.event_date}
            />
          </div>

          {/* Preis */}
          <div className="rounded-lg border border-hairline p-4 space-y-3 bg-paper">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">Leistung & Preis</p>

            {/* Mit/Ohne Drucker */}
            <div className="grid grid-cols-2 gap-3">
              <label className={cn(
                'flex flex-col gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors',
                form.with_printer
                  ? 'border-gold bg-gold/5'
                  : 'border-hairline hover:border-muted'
              )}>
                <input
                  type="radio"
                  name="printer"
                  className="sr-only"
                  checked={form.with_printer}
                  onChange={() => f('with_printer', true)}
                />
                <span className="text-sm font-medium text-ink">Mit Drucker</span>
                <span className="text-xs text-muted">inkl. 400 Fotos + Mediapaket</span>
                <span className="text-base font-bold text-gold mt-1">€ 300,–</span>
              </label>
              <label className={cn(
                'flex flex-col gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors',
                !form.with_printer
                  ? 'border-gold bg-gold/5'
                  : 'border-hairline hover:border-muted'
              )}>
                <input
                  type="radio"
                  name="printer"
                  className="sr-only"
                  checked={!form.with_printer}
                  onChange={() => f('with_printer', false)}
                />
                <span className="text-sm font-medium text-ink">Ohne Drucker</span>
                <span className="text-xs text-muted">inkl. 400 Fotos + Mediapaket</span>
                <span className="text-base font-bold text-gold mt-1">€ 200,–</span>
              </label>
            </div>

            {/* Aufbaukosten */}
            <Input
              label="Aufbaukosten (€ brutto, falls zutreffend)"
              type="number"
              step="1"
              min="0"
              value={form.setup_cost}
              onChange={e => f('setup_cost', e.target.value)}
              placeholder="0"
            />

            {/* Gesamt */}
            <div className="flex items-center justify-between pt-2 border-t border-hairline">
              <span className="text-sm text-muted">Gesamt (brutto)</span>
              <span className="text-lg font-bold text-ink tabular-nums">{formatEuro(calcTotal(form))}</span>
            </div>
          </div>

          {/* Status */}
          <Select
            label="Status"
            value={form.status}
            onChange={e => f('status', e.target.value as BookingForm['status'])}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />

          {/* Notizen */}
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
