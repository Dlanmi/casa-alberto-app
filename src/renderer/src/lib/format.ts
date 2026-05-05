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

/**
 * Formato compacto de pesos colombianos para charts: $120k, $2,4M, $1,2B.
 * El símbolo `$` siempre va adelante. Usa coma como separador decimal
 * (convención es-CO). Negativos llevan signo: -$50k.
 *
 * Reglas:
 *   - |value| < 1_000        → `$1.234` (3 dígitos exactos, sin sufijo)
 *   - 1_000 ≤ |value| < 1M   → `$120k` o `$1,2k` (1 decimal si no es múltiplo de 100)
 *   - 1M ≤ |value| < 1B      → `$2,4M`
 *   - |value| ≥ 1B           → `$1,2B`
 *
 * Diseñado para el eje Y de los charts donde el espacio es limitado y el
 * dueño solo necesita la magnitud, no la precisión exacta.
 */
export function formatCOPCorto(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '$0'
  const abs = Math.abs(value)
  // `-0 < 0` es false en JS — un valor que termine como -0 (ej. 0 * -1)
  // mostraría "$0" sin signo. Eso es deseado para no mostrar "-$0".
  const signo = value < 0 && abs > 0 ? '-' : ''
  if (abs < 1000) {
    // Sin sufijo — usamos NumberFormat para puntos como separador de miles.
    return `${signo}$${new Intl.NumberFormat('es-CO').format(Math.round(abs))}`
  }
  const formatear = (n: number, sufijo: string): string => {
    // 1 decimal solo si no es múltiplo redondo de 100 en el valor "abreviado".
    const redondeado = Math.round(n * 10) / 10
    const str =
      redondeado === Math.trunc(redondeado)
        ? String(Math.trunc(redondeado))
        : redondeado.toFixed(1).replace('.', ',')
    return `${signo}$${str}${sufijo}`
  }
  if (abs < 1_000_000) return formatear(abs / 1000, 'k')
  if (abs < 1_000_000_000) return formatear(abs / 1_000_000, 'M')
  return formatear(abs / 1_000_000_000, 'B')
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

// Etiqueta corta del mes para charts: 'Ene', 'Feb', 'Mar'…
// Acepta 'YYYY-MM' o 'YYYY-MM-DD'.
const MESES_CORTOS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic'
]

/**
 * Devuelve la etiqueta corta del mes en es-CO. Si `incluirAnio` es true o
 * el mes es enero (cambio de año), agrega el año en formato corto: "Ene 26".
 *
 * Pensado para etiquetas del eje X en charts mes-vs-mes. La consistencia
 * "Ene" muestra el año porque cruzamos calendarios; "Feb"…"Dic" no, para
 * evitar saturar visual.
 *
 * Con input mal formado (ej. `'2026-1'` sin pad o `'2026-13'` mes inválido)
 * devuelve `'—'` y loguea warning. Antes retornaba el string crudo, lo que
 * mostraba basura en el chart cuando el upstream pasaba algo malformado.
 */
export function mesCorto(iso: string, incluirAnio = false): string {
  // Mes obligatorio en 2 dígitos y dentro de 01..12. Día opcional.
  const match = iso.match(/^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/)
  if (!match) {
    if (typeof console !== 'undefined') {
      console.warn(`mesCorto: formato inválido "${iso}" — esperaba YYYY-MM[-DD]`)
    }
    return '—'
  }
  const anio = Number(match[1])
  const mes = Number(match[2])
  const label = MESES_CORTOS[mes - 1]!
  if (incluirAnio || mes === 1) {
    return `${label} ${String(anio).slice(2)}`
  }
  return label
}

// Convierte una fecha a ISO "YYYY-MM-DD" tomando la fecha LOCAL (no UTC)
// para evitar corrimientos de zona horaria. .toISOString() aplica UTC y
// en Colombia eso mueve la fecha un día al final del día.
export function toFechaISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Devuelve el día de la semana (0=dom, 1=lun, ..., 6=sab) normalizando la
// hora a las 00:00 local. `new Date().getDay()` directo es frágil cerca de
// medianoche o si el sistema cambia de zona horaria — el set explícito
// garantiza que siempre interpretamos el día calendario local. Usar este
// helper en lugar de `getDay()` directo en código de UI.
export function diaSemana(date: Date = new Date()): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getDay()
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
