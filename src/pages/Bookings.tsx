import { useEffect, useRef, useState, useCallback } from 'react'
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

declare global {
  interface Window {
    google: typeof google
    __gmapsReady?: () => void
  }
}

const FIELD_CLASS = 'w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-gold focus:border-gold transition-colors'

const BASE_PRICE_MIT_DRUCKER = 300
const BASE_PRICE_OHNE_DRUCKER = 200

type BookingForm = {
  title: string
  billing_company: string
  billing_address: string
  billing_email: string
  location: string
  aufbaudatum: string
  event_date: string
  with_printer: boolean
  setup_cost: string
  custom_price: string
  status: 'option' | 'bestaetigt' | 'storniert'
  notes: string
}

const emptyForm: BookingForm = {
  title: '',
  billing_company: '',
  billing_address: '',
  billing_email: '',
  location: '',
  aufbaudatum: '',
  event_date: isoToday(),
  with_printer: true,
  setup_cost: '',
  custom_price: '',
  status: 'option',
  notes: '',
}

function calcStandardTotal(form: Pick<BookingForm, 'with_printer' | 'setup_cost'>): number {
  const base = form.with_printer ? BASE_PRICE_MIT_DRUCKER : BASE_PRICE_OHNE_DRUCKER
  return base + (parseFloat(form.setup_cost) || 0)
}

function calcTotal(form: BookingForm): number {
  if (form.custom_price !== '') return parseFloat(form.custom_price) || 0
  return calcStandardTotal(form)
}

// ─── Google Places Autocomplete ────────────────────────────────────────────────
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined

let gmapsLoaded = false
let gmapsLoading = false
const gmapsCallbacks: (() => void)[] = []

function loadGoogleMaps(cb: () => void) {
  if (gmapsLoaded) { cb(); return }
  gmapsCallbacks.push(cb)
  if (gmapsLoading) return
  gmapsLoading = true
  window.__gmapsReady = () => {
    gmapsLoaded = true
    gmapsCallbacks.forEach(fn => fn())
    gmapsCallbacks.length = 0
  }
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&callback=__gmapsReady`
  script.async = true
  script.defer = true
  document.head.appendChild(script)
}

function CompanyInput({
  value,
  onChange,
  onPlaceSelect,
  inputKey,
}: {
  value: string
  onChange: (v: string) => void
  onPlaceSelect: (company: string, address: string) => void
  inputKey: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    if (!GOOGLE_API_KEY || !inputRef.current) return

    const initAC = () => {
      if (!inputRef.current) return
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment'],
        fields: ['name', 'formatted_address'],
        componentRestrictions: { country: 'de' },
      })
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current!.getPlace()
        const company = place.name ?? ''
        const address = (place.formatted_address ?? '').replace(', Deutschland', '').trim()
        onPlaceSelect(company, address)
      })
    }

    loadGoogleMaps(initAC)
    return () => {
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [inputKey, onPlaceSelect])

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted uppercase tracking-wide">
        Firma / Rechnungsempfänger
        {GOOGLE_API_KEY && <span className="ml-1 text-gold normal-case font-normal">· Autocomplete</span>}
      </label>
      <input
        key={inputKey}
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={e => onChange(e.target.value)}
        placeholder={GOOGLE_API_KEY ? 'Firmenname tippen für Vorschläge…' : 'z. B. Muster GmbH oder Max Mustermann'}
        className={FIELD_CLASS}
      />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [modalKey, setModalKey] = useState(0)

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
    setModalKey(k => k + 1)
    setModalOpen(true)
  }

  const openEdit = (b: BookingWithRefs) => {
    const hasAufbau = b.start_date !== b.end_date
    setForm({
      title: b.title,
      billing_company: b.billing_company ?? '',
      billing_address: b.billing_address ?? '',
      billing_email: b.billing_email ?? '',
      location: b.location ?? '',
      aufbaudatum: hasAufbau ? b.start_date : '',
      event_date: b.end_date,
      with_printer: b.with_printer ?? true,
      setup_cost: b.setup_cost != null ? String(b.setup_cost) : '',
      custom_price: b.custom_price != null ? String(b.custom_price) : '',
      status: b.status,
      notes: b.notes ?? '',
    })
    setFormErrors({})
    setEditMode(true)
    setModalKey(k => k + 1)
    setModalOpen(true)
  }

  const validate = (): boolean => {
    const errors: Partial<Record<keyof BookingForm, string>> = {}
    if (!form.title.trim()) errors.title = 'Pflichtfeld'
    if (!form.event_date) errors.event_date = 'Pflichtfeld'
    if (form.aufbaudatum && form.aufbaudatum >= form.event_date)
      errors.aufbaudatum = 'Aufbaudatum muss vor dem Veranstaltungstag liegen'
    if (form.billing_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.billing_email))
      errors.billing_email = 'Ungültige E-Mail-Adresse'
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
      const customPriceVal = form.custom_price !== '' ? parseFloat(form.custom_price) : null
      const payload = {
        title: form.title.trim(),
        box_id: defaultBox.id,
        billing_company: form.billing_company || null,
        billing_address: form.billing_address || null,
        billing_email: form.billing_email || null,
        location: form.location || null,
        start_date: hasAufbau ? form.aufbaudatum : form.event_date,
        end_date: form.event_date,
        logistics: hasAufbau ? ('aufbau' as const) : ('abholung' as const),
        with_printer: form.with_printer,
        setup_cost: parseFloat(form.setup_cost) || null,
        custom_price: customPriceVal,
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
      if (data?.error) throw new Error(data.error)
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
      const { data, error } = await supabase.functions.invoke('send-to-accounting', {
        body: { booking_id: b.id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
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

  const handlePlaceSelect = useCallback((company: string, address: string) => {
    setForm(prev => ({ ...prev, billing_company: company, billing_address: address }))
  }, [])

  const drawerHasAufbau = drawer ? drawer.start_date !== drawer.end_date : false
  const standardTotal = drawer
    ? (drawer.with_printer ? BASE_PRICE_MIT_DRUCKER : BASE_PRICE_OHNE_DRUCKER) + (drawer.setup_cost ?? 0)
    : 0

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
                      {b.custom_price != null && (
                        <span className="text-xs text-gold mr-1">Sonder</span>
                      )}
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

            {(drawer.billing_company || drawer.billing_address || drawer.billing_email) && (
              <DrawerSection title="Auftraggeber">
                {drawer.billing_company && <DrawerField label="Firma" value={drawer.billing_company} />}
                {drawer.billing_address && <DrawerField label="Adresse" value={drawer.billing_address} />}
                {drawer.billing_email && (
                  <DrawerField
                    label="Rechnungs-E-Mail"
                    value={<a href={`mailto:${drawer.billing_email}`} className="text-gold hover:underline">{drawer.billing_email}</a>}
                  />
                )}
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
              {drawer.custom_price != null && (
                <>
                  <DrawerField
                    label="Regulärpreis"
                    value={<span className="line-through text-muted">{formatEuro(standardTotal)}</span>}
                  />
                  <DrawerField
                    label="Sonderpreis"
                    value={<span className="text-gold font-semibold">{formatEuro(drawer.custom_price)}</span>}
                  />
                </>
              )}
              <DrawerField
                label="Gesamt (brutto)"
                value={<span className="font-semibold text-ink">{formatEuro(drawer.price_net)}</span>}
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
          <CompanyInput
            value={form.billing_company}
            onChange={v => f('billing_company', v)}
            onPlaceSelect={handlePlaceSelect}
            inputKey={`company-${modalKey}`}
          />
          <Textarea
            label="Rechnungsadresse"
            value={form.billing_address}
            onChange={e => f('billing_address', e.target.value)}
            placeholder={'Musterstraße 1\n12345 Musterstadt'}
          />
          <Input
            label="Rechnungs-E-Mail"
            type="email"
            value={form.billing_email}
            onChange={e => f('billing_email', e.target.value)}
            placeholder="rechnung@beispiel.de"
            error={formErrors.billing_email}
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

            <div className="grid grid-cols-2 gap-3">
              <label className={cn(
                'flex flex-col gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors',
                form.with_printer ? 'border-gold bg-gold/5' : 'border-hairline hover:border-muted'
              )}>
                <input type="radio" name="printer" className="sr-only" checked={form.with_printer}
                  onChange={() => f('with_printer', true)} />
                <span className="text-sm font-medium text-ink">Mit Drucker</span>
                <span className="text-xs text-muted">inkl. 400 Fotos + Mediapaket</span>
                <span className="text-base font-bold text-gold mt-1">€ 300,–</span>
              </label>
              <label className={cn(
                'flex flex-col gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors',
                !form.with_printer ? 'border-gold bg-gold/5' : 'border-hairline hover:border-muted'
              )}>
                <input type="radio" name="printer" className="sr-only" checked={!form.with_printer}
                  onChange={() => f('with_printer', false)} />
                <span className="text-sm font-medium text-ink">Ohne Drucker</span>
                <span className="text-xs text-muted">inkl. 400 Fotos + Mediapaket</span>
                <span className="text-base font-bold text-gold mt-1">€ 200,–</span>
              </label>
            </div>

            <Input
              label="Aufbaukosten (€ brutto, falls zutreffend)"
              type="number"
              step="1"
              min="0"
              value={form.setup_cost}
              onChange={e => f('setup_cost', e.target.value)}
              placeholder="0"
            />

            {/* Sonderpreis */}
            <div className="border-t border-hairline pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted uppercase tracking-wide">Sonderpreis / Rabatt</span>
                {form.custom_price !== '' && (
                  <button
                    type="button"
                    onClick={() => f('custom_price', '')}
                    className="text-xs text-muted hover:text-status-red"
                  >
                    Zurücksetzen
                  </button>
                )}
              </div>
              <Input
                type="number"
                step="1"
                min="0"
                value={form.custom_price}
                onChange={e => f('custom_price', e.target.value)}
                placeholder={`Leer lassen für Standardpreis (${formatEuro(calcStandardTotal(form))})`}
                hint={form.custom_price !== '' ? `Standardpreis wäre: ${formatEuro(calcStandardTotal(form))}` : undefined}
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-hairline">
              <div>
                <span className="text-sm text-muted">Gesamt (brutto)</span>
                {form.custom_price !== '' && (
                  <span className="ml-2 text-xs bg-gold/10 text-gold px-1.5 py-0.5 rounded font-medium">Sonderpreis</span>
                )}
              </div>
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
