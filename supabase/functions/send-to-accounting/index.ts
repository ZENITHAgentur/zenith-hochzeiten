import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { booking_id } = await req.json()
    if (!booking_id) throw new Error('booking_id fehlt')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('*, customers(*), boxes(*)')
      .eq('id', booking_id)
      .single()
    if (bErr || !booking) throw new Error('Buchung nicht gefunden')

    const customer = booking.customers
    const box = booking.boxes

    // Format date DE
    const fmtDate = (d: string | null) => {
      if (!d) return '—'
      const [y, m, day] = d.split('-')
      return `${day}.${m}.${y}`
    }
    const fmtEuro = (v: number | null) =>
      v != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '—'

    const dateRange = booking.start_date === booking.end_date
      ? fmtDate(booking.start_date)
      : `${fmtDate(booking.start_date)} – ${fmtDate(booking.end_date)}`

    const mocoLink = booking.moco_invoice_id
      ? `\nhttps://${Deno.env.get('MOCO_DOMAIN')}.mocoapp.com/invoices/${booking.moco_invoice_id}`
      : ''

    const body = `Buchungsübergabe an Buchhaltung
================================

Anlass:       ${booking.title}
Box:          ${box?.name ?? '—'}
Zeitraum:     ${dateRange}
Ort:          ${booking.location ?? '—'}
Logistik:     ${booking.logistics === 'aufbau' ? 'Auf-/Abbau (wir)' : 'Abholung (Kunde)'}
Mediapakete:  ${booking.media_packages}× (à 400 Fotos)
Preis Netto:  ${fmtEuro(booking.price_net)}
Status:       ${booking.status}

Rechnungsanschrift:
${[
  customer?.company,
  customer?.contact ? `z. Hd. ${customer.contact}` : null,
  customer?.street,
  [customer?.zip, customer?.city].filter(Boolean).join(' '),
  customer?.vat_id ? `USt-IdNr.: ${customer.vat_id}` : null,
].filter(Boolean).join('\n')}

Rechnungsstatus: ${booking.invoice_status}${mocoLink}

${booking.notes ? `Notizen:\n${booking.notes}` : ''}
`.trim()

    const accountingEmail = Deno.env.get('ACCOUNTING_EMAIL') ?? 'buchhaltung@zenith-agentur.de'
    const resendKey = Deno.env.get('RESEND_API_KEY')

    if (resendKey) {
      // Versand über Resend
      const mailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Fotobox-Dashboard <noreply@zenith-agentur.de>',
          to: accountingEmail,
          subject: `Buchungsübergabe: ${booking.title} (${dateRange})`,
          text: body,
        }),
      })
      if (!mailRes.ok) {
        const t = await mailRes.text()
        throw new Error(`Resend-Fehler: ${t}`)
      }
    }

    // Immer Erfolg zurückgeben (auch ohne Resend – dann nur interne Notiz)
    return new Response(
      JSON.stringify({ success: true, preview: body }),
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
