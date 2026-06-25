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

// Pricing constants – adjust as needed
const SETUP_FEE = 250          // Auf-/Abbau-Pauschale (nur bei logistics='aufbau')
const MEDIA_PACKAGE_PRICE = 99 // Pro Mediapaket à 400 Fotos

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { booking_id } = await req.json()
    if (!booking_id) throw new Error('booking_id fehlt')

    // Service-role client – darf invoice-Felder schreiben
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Buchung + Kunde + Box laden
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('*, customers(*), boxes(*)')
      .eq('id', booking_id)
      .single()
    if (bErr || !booking) throw new Error('Buchung nicht gefunden')
    if (booking.invoice_status !== 'keine') throw new Error('Rechnungsentwurf bereits vorhanden')

    const customer = booking.customers
    const box = booking.boxes

    // 2. MOCO-Kunde finden oder anlegen
    let mocoCompanyId: number = customer?.moco_company_id ?? 0

    if (!mocoCompanyId && customer) {
      // Suche nach Firmenname
      const searchRes = await fetch(
        `${MOCO_BASE}/companies?term=${encodeURIComponent(customer.company)}&type=customer`,
        { headers: MOCO_HEADERS },
      )
      const companies = await searchRes.json()

      if (Array.isArray(companies) && companies.length > 0) {
        mocoCompanyId = companies[0].id
      } else {
        // Neu anlegen
        const createRes = await fetch(`${MOCO_BASE}/companies`, {
          method: 'POST',
          headers: MOCO_HEADERS,
          body: JSON.stringify({
            name: customer.company,
            type: 'customer',
            country_code: 'DE',
            vat_identifier: customer.vat_id ?? undefined,
            phone: customer.phone ?? undefined,
            email: customer.email ?? undefined,
          }),
        })
        if (!createRes.ok) {
          const t = await createRes.text()
          throw new Error(`MOCO Firma anlegen fehlgeschlagen: ${t}`)
        }
        const created = await createRes.json()
        mocoCompanyId = created.id

        // moco_company_id zurückschreiben
        await supabase
          .from('customers')
          .update({ moco_company_id: mocoCompanyId })
          .eq('id', customer.id)
      }
    }

    // 3. Rechnungsposten zusammenstellen
    const items: object[] = []

    // Hauptposition: vereinbarter Netto-Mietpreis
    if (booking.price_net) {
      items.push({
        type: 'item',
        title: `Fotobox-Miete – ${box?.name ?? 'Fotobox'}`,
        quantity: 1,
        unit: 'Pauschale',
        unit_price: booking.price_net,
      })
    }

    // Auf-/Abbau nur wenn logistics='aufbau'
    if (booking.logistics === 'aufbau') {
      items.push({
        type: 'item',
        title: 'Auf-/Abbau & Anfahrt',
        quantity: 1,
        unit: 'pauschal',
        unit_price: SETUP_FEE,
      })
    }

    // Mediapakete
    if (booking.media_packages > 0) {
      items.push({
        type: 'item',
        title: 'Mediapaket à 400 Fotos',
        quantity: booking.media_packages,
        unit: 'Paket',
        unit_price: MEDIA_PACKAGE_PRICE,
      })
    }

    // Rechnungsanschrift zusammensetzen
    const addrParts = [
      customer?.company,
      customer?.contact ? `z. Hd. ${customer.contact}` : undefined,
      customer?.street,
      [customer?.zip, customer?.city].filter(Boolean).join(' '),
    ].filter(Boolean)
    const recipientAddress = addrParts.join('\n')

    // Fälligkeitsdatum: +14 Tage
    const today = new Date().toISOString().slice(0, 10)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)
    const dueDateStr = dueDate.toISOString().slice(0, 10)

    // 4. Rechnungsentwurf in MOCO anlegen
    const invoicePayload = {
      customer_id: mocoCompanyId,
      recipient_address: recipientAddress,
      date: today,
      due_date: dueDateStr,
      service_period_from: booking.start_date,
      service_period_to: booking.end_date,
      title: `Fotobox-Vermietung – ${booking.title}`,
      currency: 'EUR',
      tax: 19.0,
      status: 'created', // = Entwurf, wird NICHT automatisch versendet
      items,
    }

    const invoiceRes = await fetch(`${MOCO_BASE}/invoices`, {
      method: 'POST',
      headers: MOCO_HEADERS,
      body: JSON.stringify(invoicePayload),
    })
    if (!invoiceRes.ok) {
      const t = await invoiceRes.text()
      throw new Error(`MOCO Rechnung anlegen fehlgeschlagen: ${t}`)
    }
    const invoice = await invoiceRes.json()

    // 5. invoice_id + Status zurückschreiben (nur via Service-Role erlaubt)
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
