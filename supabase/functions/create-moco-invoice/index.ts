import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MOCO_BASE = `https://${Deno.env.get('MOCO_DOMAIN')}.mocoapp.com/api/v1`
const MOCO_HEADERS = {
  'Authorization': `Token token=${Deno.env.get('MOCO_API_KEY')}`,
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { booking_id } = await req.json()
    if (!booking_id) throw new Error('booking_id fehlt')

    const mocoDomain = Deno.env.get('MOCO_DOMAIN')
    const mocoKey = Deno.env.get('MOCO_API_KEY')
    if (!mocoDomain || !mocoKey) throw new Error('MOCO_DOMAIN oder MOCO_API_KEY nicht konfiguriert')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Buchung laden (ohne customers-Join)
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('*, boxes(*)')
      .eq('id', booking_id)
      .single()
    if (bErr || !booking) throw new Error('Buchung nicht gefunden')
    if (booking.invoice_status !== 'keine') throw new Error('Rechnungsentwurf bereits vorhanden')

    const box = booking.boxes
    const companyName = booking.billing_company ?? 'Unbekannt'

    // MOCO-Firma suchen oder anlegen
    let mocoCompanyId = 0

    const searchRes = await fetch(
      `${MOCO_BASE}/companies?term=${encodeURIComponent(companyName)}&type=customer`,
      { headers: MOCO_HEADERS },
    )
    if (!searchRes.ok) throw new Error(`MOCO-Suche fehlgeschlagen: ${await searchRes.text()}`)
    const companies = await searchRes.json()

    if (Array.isArray(companies) && companies.length > 0) {
      mocoCompanyId = companies[0].id
    } else {
      const createRes = await fetch(`${MOCO_BASE}/companies`, {
        method: 'POST',
        headers: MOCO_HEADERS,
        body: JSON.stringify({
          name: companyName,
          type: 'customer',
          country_code: 'DE',
          email: booking.billing_email ?? undefined,
        }),
      })
      if (!createRes.ok) throw new Error(`MOCO Firma anlegen fehlgeschlagen: ${await createRes.text()}`)
      const created = await createRes.json()
      mocoCompanyId = created.id
    }

    // Rechnungsanschrift aus Inline-Feldern
    const recipientAddress = [
      companyName,
      booking.billing_address,
    ].filter(Boolean).join('\n')

    // Rechnungsposten
    const items: object[] = [
      {
        type: 'item',
        title: booking.with_printer
          ? `Fotobox-Miete mit Drucker – ${box?.name ?? 'Fotobox'} · inkl. 400 Fotos + Mediapaket`
          : `Fotobox-Miete ohne Drucker – ${box?.name ?? 'Fotobox'} · inkl. 400 Fotos + Mediapaket`,
        quantity: 1,
        unit: 'Pauschale',
        unit_price: booking.with_printer ? 300 : 200,
      },
    ]

    if (booking.setup_cost && booking.setup_cost > 0) {
      items.push({
        type: 'item',
        title: 'Auf-/Abbau & Anfahrt',
        quantity: 1,
        unit: 'pauschal',
        unit_price: booking.setup_cost,
      })
    }

    // Bei Sonderpreis: Rabatt-Position
    if (booking.custom_price != null) {
      const regularTotal = (booking.with_printer ? 300 : 200) + (booking.setup_cost ?? 0)
      const discount = booking.custom_price - regularTotal
      if (discount !== 0) {
        items.push({
          type: 'item',
          title: discount < 0 ? 'Rabatt / Sonderpreis' : 'Aufpreis',
          quantity: 1,
          unit: 'pauschal',
          unit_price: discount,
        })
      }
    }

    const today = new Date().toISOString().slice(0, 10)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    const invoicePayload = {
      customer_id: mocoCompanyId,
      recipient_address: recipientAddress,
      date: today,
      due_date: dueDate.toISOString().slice(0, 10),
      service_period_from: booking.end_date,
      service_period_to: booking.end_date,
      title: `Fotobox-Vermietung – ${booking.title}`,
      currency: 'EUR',
      tax: 19.0,
      status: 'created',
      items,
    }

    const invoiceRes = await fetch(`${MOCO_BASE}/invoices`, {
      method: 'POST',
      headers: MOCO_HEADERS,
      body: JSON.stringify(invoicePayload),
    })
    if (!invoiceRes.ok) throw new Error(`MOCO Rechnung anlegen fehlgeschlagen: ${await invoiceRes.text()}`)
    const invoice = await invoiceRes.json()

    await supabase
      .from('bookings')
      .update({ moco_invoice_id: invoice.id, invoice_status: 'entwurf' })
      .eq('id', booking_id)

    return new Response(
      JSON.stringify({ success: true, invoice_id: invoice.id }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
