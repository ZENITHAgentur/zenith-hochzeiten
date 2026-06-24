export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}.${m}.${y}`
}

export function formatEuro(val: number | null | undefined): string {
  if (val == null) return '—'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val)
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(start)
  return `${formatDate(start)} – ${formatDate(end)}`
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(dateStr).getTime() - today.getTime()) / 86400000)
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Returns an array of ISO date strings for every day in [start, end] (inclusive) */
export function dateRange(start: string, end: string): string[] {
  const result: string[] = []
  const cur = new Date(start)
  const endDate = new Date(end)
  while (cur <= endDate) {
    result.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

export const STATUS_LABELS: Record<string, string> = {
  option: 'Option',
  bestaetigt: 'Bestätigt',
  storniert: 'Storniert',
}

export const INVOICE_LABELS: Record<string, string> = {
  keine: 'Keine Rechnung',
  entwurf: 'Entwurf',
  bezahlt: 'Bezahlt',
}

export const LOGISTICS_LABELS: Record<string, string> = {
  aufbau: 'Auf-/Abbau (wir)',
  abholung: 'Abholung (Kunde)',
}
