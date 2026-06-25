import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Customer, BookingWithRefs } from '@/lib/database.types'
import { formatDate, formatEuro, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Drawer, DrawerSection, DrawerField } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { StatusBadge, InvoiceBadge } from '@/components/ui/Badge'
import type { ToastData } from '@/components/ui/Toast'

type CustomerWithStats = Customer & {
  bookingCount: number
  totalRevenue: number
  lastBookingDate: string | null
}

type CustomerForm = {
  company: string
  contact: string
  street: string
  zip: string
  city: string
  email: string
  phone: string
  vat_id: string
}

const emptyForm: CustomerForm = {
  company: '',
  contact: '',
  street: '',
  zip: '',
  city: '',
  email: '',
  phone: '',
  vat_id: '',
}

export function Customers({ onToast }: { onToast: (t: ToastData) => void }) {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [drawer, setDrawer] = useState<CustomerWithStats | null>(null)
  const [drawerBookings, setDrawerBookings] = useState<BookingWithRefs[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<CustomerForm>(emptyForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CustomerForm, string>>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [{ data: cData }, { data: bData }] = await Promise.all([
      supabase.from('customers').select('*').order('company'),
      supabase.from('bookings').select('*, boxes(*), customers(*)').neq('status', 'storniert'),
    ])
    const bookings = (bData ?? []) as BookingWithRefs[]
    const enriched: CustomerWithStats[] = (cData ?? []).map(c => {
      const cb = bookings.filter(b => b.customer_id === c.id)
      return {
        ...c,
        bookingCount: cb.length,
        totalRevenue: cb.reduce((s, b) => s + (b.price_net ?? 0), 0),
        lastBookingDate: cb.length
          ? cb.sort((a, b) => b.start_date.localeCompare(a.start_date))[0].start_date
          : null,
      }
    })
    setCustomers(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const loadDrawerBookings = async (customerId: string) => {
    const { data } = await supabase
      .from('bookings')
      .select('*, boxes(*), customers(*)')
      .eq('customer_id', customerId)
      .order('start_date', { ascending: false })
    setDrawerBookings((data ?? []) as BookingWithRefs[])
  }

  const openDrawer = (c: CustomerWithStats) => {
    setDrawer(c)
    loadDrawerBookings(c.id)
  }

  const openNew = () => {
    setForm(emptyForm)
    setFormErrors({})
    setEditMode(false)
    setModalOpen(true)
  }

  const openEdit = (c: CustomerWithStats) => {
    setForm({
      company: c.company,
      contact: c.contact ?? '',
      street: c.street ?? '',
      zip: c.zip ?? '',
      city: c.city ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      vat_id: c.vat_id ?? '',
    })
    setFormErrors({})
    setEditMode(true)
    setModalOpen(true)
  }

  const validate = (): boolean => {
    const errors: Partial<Record<keyof CustomerForm, string>> = {}
    if (!form.company.trim()) errors.company = 'Pflichtfeld'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const saveCustomer = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        company: form.company.trim(),
        contact: form.contact || null,
        street: form.street || null,
        zip: form.zip || null,
        city: form.city || null,
        email: form.email || null,
        phone: form.phone || null,
        vat_id: form.vat_id || null,
      }
      if (editMode && drawer) {
        await supabase.from('customers').update(payload).eq('id', drawer.id)
      } else {
        await supabase.from('customers').insert(payload)
      }
      await load()
      setModalOpen(false)
      setDrawer(null)
      onToast({ message: editMode ? 'Kunde aktualisiert' : 'Kunde angelegt', type: 'success' })
    } catch {
      onToast({ message: 'Fehler beim Speichern', type: 'error' })
    }
    setSaving(false)
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return !q
      || c.company.toLowerCase().includes(q)
      || c.contact?.toLowerCase().includes(q)
      || c.city?.toLowerCase().includes(q)
      || c.email?.toLowerCase().includes(q)
  })

  const f = (key: keyof CustomerForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex gap-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suchen nach Firma, Kontakt, Stadt…"
          className="flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-gold"
        />
        <Button variant="primary" onClick={openNew}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Neuer Kunde
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-hairline overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted text-sm">Lade Kunden…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-muted text-sm mb-3">
              {search ? 'Keine Kunden gefunden.' : 'Noch keine Kunden – lege den ersten an.'}
            </p>
            {!search && <Button variant="primary" size="sm" onClick={openNew}>Neuer Kunde</Button>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-paper">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Firma</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden md:table-cell">Kontakt</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">Stadt</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide">Buchungen</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden md:table-cell">Umsatz</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hidden lg:table-cell">Letzter Einsatz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => openDrawer(c)}
                  className="hover:bg-paper cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{c.company}</div>
                    {c.email && <div className="text-xs text-muted">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted hidden md:table-cell">{c.contact ?? '—'}</td>
                  <td className="px-4 py-3 text-muted hidden lg:table-cell">{c.city ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-right font-medium text-ink">{c.bookingCount}</td>
                  <td className="px-4 py-3 tabular-nums text-right font-medium text-ink hidden md:table-cell">{formatEuro(c.totalRevenue)}</td>
                  <td className="px-4 py-3 tabular-nums text-right text-muted hidden lg:table-cell">{formatDate(c.lastBookingDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        title={drawer?.company ?? 'Kunde'}
        footer={
          drawer ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 justify-center"
                onClick={() => openEdit(drawer)}
              >
                Bearbeiten
              </Button>
            </div>
          ) : null
        }
      >
        {drawer && (
          <div className="space-y-5">
            <DrawerSection title="Stammdaten">
              <DrawerField label="Firma" value={drawer.company} />
              <DrawerField label="Kontakt" value={drawer.contact} />
              <DrawerField label="E-Mail" value={drawer.email} />
              <DrawerField label="Telefon" value={drawer.phone} />
              {drawer.vat_id && <DrawerField label="USt-IdNr." value={drawer.vat_id} />}
              {drawer.moco_company_id && (
                <DrawerField label="MOCO-ID" value={<span className="tabular-nums">{drawer.moco_company_id}</span>} />
              )}
            </DrawerSection>

            <DrawerSection title="Adresse">
              <DrawerField label="Straße" value={drawer.street} />
              <DrawerField label="PLZ / Ort" value={[drawer.zip, drawer.city].filter(Boolean).join(' ') || null} />
            </DrawerSection>

            <DrawerSection title="Kennzahlen">
              <DrawerField label="Buchungen gesamt" value={drawer.bookingCount} />
              <DrawerField label="Umsatz (Netto)" value={formatEuro(drawer.totalRevenue)} />
              <DrawerField label="Letzter Einsatz" value={formatDate(drawer.lastBookingDate)} />
              <DrawerField label="Kunde seit" value={formatDate(drawer.created_at.slice(0, 10))} />
            </DrawerSection>

            {drawerBookings.length > 0 && (
              <DrawerSection title="Buchungen">
                <div className="space-y-2">
                  {drawerBookings.map(b => (
                    <div key={b.id} className="flex items-center justify-between text-sm bg-paper rounded-lg px-3 py-2">
                      <div>
                        <p className="text-ink font-medium">{b.title}</p>
                        <p className="text-xs text-muted">{formatDate(b.start_date)} · {b.boxes?.name}</p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <StatusBadge status={b.status} />
                        <InvoiceBadge status={b.invoice_status} />
                      </div>
                    </div>
                  ))}
                </div>
              </DrawerSection>
            )}
          </div>
        )}
      </Drawer>

      {/* New/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editMode ? 'Kunde bearbeiten' : 'Neuer Kunde'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Abbrechen</Button>
            <Button variant="primary" loading={saving} onClick={saveCustomer}>
              {editMode ? 'Speichern' : 'Kunde anlegen'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Firma / Name *"
            value={form.company}
            onChange={e => f('company', e.target.value)}
            placeholder="Muster GmbH"
            error={formErrors.company}
          />
          <Input
            label="Ansprechpartner:in"
            value={form.contact}
            onChange={e => f('contact', e.target.value)}
            placeholder="Max Mustermann"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="E-Mail"
              type="email"
              value={form.email}
              onChange={e => f('email', e.target.value)}
              placeholder="max@beispiel.de"
            />
            <Input
              label="Telefon"
              type="tel"
              value={form.phone}
              onChange={e => f('phone', e.target.value)}
              placeholder="+49 …"
            />
          </div>
          <Input
            label="Straße"
            value={form.street}
            onChange={e => f('street', e.target.value)}
            placeholder="Musterstraße 1"
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="PLZ"
              value={form.zip}
              onChange={e => f('zip', e.target.value)}
              placeholder="12345"
            />
            <div className="col-span-2">
              <Input
                label="Ort"
                value={form.city}
                onChange={e => f('city', e.target.value)}
                placeholder="Musterstadt"
              />
            </div>
          </div>
          <Input
            label="USt-IdNr."
            value={form.vat_id}
            onChange={e => f('vat_id', e.target.value)}
            placeholder="DE123456789"
          />
        </div>
      </Modal>
    </div>
  )
}
