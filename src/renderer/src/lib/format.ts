// ---- Currency (COP) ----

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
})

export function formatCOP(value: number): string {
  return copFormatter.format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CO').format(value)
}

// ---- Dates (Colombian format) ----

const dateLong = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})

const dateShort = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short'
})

export function formatFechaLarga(iso: string): string {
  return dateLong.format(new Date(iso + 'T12:00:00'))
}

export function formatFechaCorta(iso: string): string {
  return dateShort.format(new Date(iso + 'T12:00:00'))
}

export function formatFechaRelativa(iso: string): string {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(iso + 'T12:00:00')
  fecha.setHours(0, 0, 0, 0)
  const diffMs = fecha.getTime() - hoy.getTime()
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDias === 0) return 'Hoy'
  if (diffDias === 1) return 'Manana'
  if (diffDias === -1) return 'Ayer'
  if (diffDias > 1 && diffDias <= 7) return `En ${diffDias} dias`
  if (diffDias < -1 && diffDias >= -7) return `Hace ${Math.abs(diffDias)} dias`
  return formatFechaCorta(iso)
}

export function diasRestantes(iso: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(iso + 'T12:00:00')
  fecha.setHours(0, 0, 0, 0)
  return Math.round((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function mesActualISO(): string {
  return new Date().toISOString().slice(0, 7)
}

// ---- Phone ----

export function formatTelefono(tel: string | null | undefined): string {
  if (!tel) return ''
  const digits = tel.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`
  }
  return tel
}

// ---- Initials (for avatars) ----

export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}
