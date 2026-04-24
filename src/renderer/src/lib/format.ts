// ---- Currency (COP) ----

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
})

// Defensivo contra NaN/Infinity/null/undefined: cualquier valor no finito se
// muestra como "$0" en lugar de "$NaN" (que se veía feo en PDFs y cards).
// Alguien confiando en cálculos upstream podría pasar valores corruptos.
export function formatCOP(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return copFormatter.format(0)
  return copFormatter.format(value)
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '0'
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

// Guard común: si el string no es una fecha ISO válida (null, "", "Invalid"),
// retorna "—" en lugar de "Invalid Date" feo.
function parseISO(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatFechaLarga(iso: string | null | undefined): string {
  const d = parseISO(iso)
  return d ? dateLong.format(d) : '—'
}

export function formatFechaCorta(iso: string | null | undefined): string {
  const d = parseISO(iso)
  return d ? dateShort.format(d) : '—'
}

export function formatFechaRelativa(iso: string): string {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(iso + 'T12:00:00')
  fecha.setHours(0, 0, 0, 0)
  const diffMs = fecha.getTime() - hoy.getTime()
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDias === 0) return 'Hoy'
  if (diffDias === 1) return 'Mañana'
  if (diffDias === -1) return 'Ayer'
  if (diffDias > 1 && diffDias <= 7) return `En ${diffDias} días`
  if (diffDias < -1 && diffDias >= -7) return `Hace ${Math.abs(diffDias)} días`
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
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function mesActualISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Convierte una fecha a ISO "YYYY-MM-DD" tomando la fecha LOCAL (no UTC)
// para evitar corrimientos de zona horaria. .toISOString() aplica UTC y
// en Colombia eso mueve la fecha un día al final del día.
export function toFechaISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Devuelve el lunes (inicio de semana) de la semana que contiene `date`.
// Semana en es-CO empieza en lunes. Normaliza a inicio del día (00:00)
// para que `getTime()` sea determinístico.
export function inicioSemana(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=dom, 1=lun, ..., 6=sab
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d
}

// Devuelve el domingo (fin de semana) de la semana que contiene `date`.
export function finSemana(date: Date = new Date()): Date {
  const lunes = inicioSemana(date)
  const domingo = new Date(lunes)
  domingo.setDate(lunes.getDate() + 6)
  return domingo
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

export function iniciales(nombre: string | null | undefined): string {
  if (!nombre || !nombre.trim()) return '?'
  const result = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return result || '?'
}
