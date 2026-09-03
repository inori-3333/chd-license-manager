const ISO = /^\d{4}-\d{2}-\d{2}$/

export function parseDate(raw: string | undefined | null): string | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (ISO.test(s)) {
    const t = Date.parse(s + 'T00:00:00')
    return Number.isNaN(t) ? null : s
  }
  const slash = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/)
  if (slash) {
    const y = slash[1]
    const m = slash[2].padStart(2, '0')
    const d = slash[3].padStart(2, '0')
    const iso = `${y}-${m}-${d}`
    const t = Date.parse(iso + 'T00:00:00')
    return Number.isNaN(t) ? null : iso
  }
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (compact) {
    const iso = `${compact[1]}-${compact[2]}-${compact[3]}`
    const t = Date.parse(iso + 'T00:00:00')
    return Number.isNaN(t) ? null : iso
  }
  return null
}

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from + 'T00:00:00')
  const b = Date.parse(to + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toIso(d)
}

export function toIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function inRange(date: string, from: string, to: string | null): boolean {
  if (date < from) return false
  if (to && date > to) return false
  return true
}

export function todayIso(): string {
  return '2026-09-03'
}
