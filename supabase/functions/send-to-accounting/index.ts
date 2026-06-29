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
      .select('*, boxes(*)')
      .eq('id', booking_id)
      .single()
    if (bErr || !booking) throw new Error('Buchung nicht gefunden')

    const box = booking.boxes

    const fmtDate = (d: string | null) => {
      if (!d) return '—'
      const [y, m, day] = d.split('-')
      return `${day}.${m}.${y}`
    }
    const fmtEuro = (v: number | null) =>
      v != null ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v) : '—'

    const hasAufbau = booking.start_date !== booking.end_date
    const paket = booking.with_printer
      ? 'Mit Drucker · inkl. 400 Fotos + Mediapaket (€ 300,–)'
      : 'Ohne Drucker · inkl. 400 Fotos + Mediapaket (€ 200,–)'

    const mocoLink = booking.moco_invoice_id
      ? `\nhttps://${Deno.env.get('MOCO_DOMAIN')}.mocoapp.com/invoices/${booking.moco_invoice_id}`
      : ''

    const body = `Buchungsübergabe an Buchhaltung
================================

Anlass:           ${booking.title}
Box:              ${box?.name ?? '—'}
${hasAufbau ? `Aufbaudatum:      ${fmtDate(booking.start_date)}\n` : ''}Veranstaltungstag: ${fmtDate(booking.end_date)}
Ort:              ${booking.location ?? '—'}
Paket:            ${paket}${booking.setup_cost ? `\nAufbaukosten:     ${fmtEuro(booking.setup_cost)}` : ''}${booking.custom_price != null ? `\nSonderpreis:      ${fmtEuro(booking.custom_price)}` : ''}
Gesamt (brutto):  ${fmtEuro(booking.price_net)}
Status:           ${booking.status}

Rechnungsanschrift:
${[booking.billing_company, booking.billing_address].filter(Boolean).join('\n') || '— keine Angabe —'}
${booking.billing_email ? `\nRechnungs-E-Mail: ${booking.billing_email}` : ''}
Rechnungsstatus: ${booking.invoice_status}${mocoLink}
${booking.notes ? `\nNotizen:\n${booking.notes}` : ''}`.trim()

    const accountingEmail = Deno.env.get('ACCOUNTING_EMAIL') ?? 'buchhaltung@zenith-agentur.de'
    const resendKey = Deno.env.get('RESEND_API_KEY')

    if (resendKey) {
      const mailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Fotobox-Dashboard <noreply@zenith-agentur.de>',
          to: accountingEmail,
          subject: `Buchungsübergabe: ${booking.title} (${fmtDate(booking.end_date)})`,
          text: body,
        }),
      })
      if (!mailRes.ok) throw new Error(`Resend-Fehler: ${await mailRes.text()}`)
    }

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
