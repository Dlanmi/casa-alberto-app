import { useMemo, useState } from 'react'
import { hoyISO, mesActualISO } from '@renderer/lib/format'

// Catálogo cerrado de períodos para los charts. Centralizado para que el
// label, el rango y la lógica vivan en un solo archivo. Agregar un período
// nuevo es: agregar una entrada y la UI de selector lo rinde solo.
export type ChartPeriodKey =
  | 'mes_actual'
  | 'ultimos_3m'
  | 'ultimos_6m'
  | 'ultimos_12m'
  | 'anio_actual'
  | 'todo'

export type ChartPeriod = {
  key: ChartPeriodKey
  label: string
  /** Calcula el rango ISO al momento de invocarse — siempre relativo a hoy. */
  rango: () => { desde: string; hasta: string }
}

/**
 * Calcula el primer día de N meses atrás desde el mes actual (inclusive).
 * Ejemplo: con today=2026-05-05 y mesesAtras=3 → '2026-03-01' (incluye mar/abr/may).
 */
function inicioVentanaMeses(mesesAtras: number): string {
  const ahora = new Date()
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - (mesesAtras - 1), 1)
  return `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-01`
}

function inicioMesActual(): string {
  return `${mesActualISO()}-01`
}

function inicioAnioActual(): string {
  const ahora = new Date()
  return `${ahora.getFullYear()}-01-01`
}

export const CHART_PERIODS: ChartPeriod[] = [
  {
    key: 'mes_actual',
    label: 'Mes actual',
    rango: () => ({ desde: inicioMesActual(), hasta: hoyISO() })
  },
  {
    key: 'ultimos_3m',
    label: 'Últimos 3 meses',
    rango: () => ({ desde: inicioVentanaMeses(3), hasta: hoyISO() })
  },
  {
    key: 'ultimos_6m',
    label: 'Últimos 6 meses',
    rango: () => ({ desde: inicioVentanaMeses(6), hasta: hoyISO() })
  },
  {
    key: 'ultimos_12m',
    label: 'Últimos 12 meses',
    rango: () => ({ desde: inicioVentanaMeses(12), hasta: hoyISO() })
  },
  {
    key: 'anio_actual',
    label: 'Año actual',
    rango: () => ({ desde: inicioAnioActual(), hasta: hoyISO() })
  },
  {
    key: 'todo',
    // Fecha "muy antigua" como floor — abarca todo el histórico de la app.
    // El campo `fecha` en SQLite es texto ordenable lexicográfico, así que
    // '1900-01-01' es seguro y consistente con el resto del schema.
    label: 'Todo',
    rango: () => ({ desde: '1900-01-01', hasta: hoyISO() })
  }
]

/**
 * Hook centralizado para el selector de período de los charts. Devuelve:
 *   - `period`: clave del período actual
 *   - `setPeriod`: setter
 *   - `desde`/`hasta`: rango ISO listo para enviar al backend
 *   - `label`: etiqueta humana del período actual
 *
 * El rango se recalcula con `useMemo` dependiente de `period` — si cambias
 * de período, los componentes consumidores se re-renderizan con el nuevo
 * rango automáticamente. La hora exacta no varía dentro del mismo período
 * (no nos importa precisión al segundo en charts financieros).
 */
export function useChartPeriod(initial: ChartPeriodKey = 'ultimos_6m'): {
  period: ChartPeriodKey
  setPeriod: (k: ChartPeriodKey) => void
  desde: string
  hasta: string
  label: string
} {
  const [period, setPeriod] = useState<ChartPeriodKey>(initial)
  const { desde, hasta, label } = useMemo(() => {
    const def = CHART_PERIODS.find((p) => p.key === period) ?? CHART_PERIODS[0]!
    const rango = def.rango()
    return { desde: rango.desde, hasta: rango.hasta, label: def.label }
  }, [period])
  return { period, setPeriod, desde, hasta, label }
}
