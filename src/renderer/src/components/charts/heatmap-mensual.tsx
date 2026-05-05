// Heatmap calendario del mes — cada día es un cuadro con intensidad
// proporcional al monto de ingresos. Útil para que el dueño identifique
// días pico (¿sábados? ¿quincenas? ¿después de quincena?).
//
// Implementación: CSS-grid puro (no Recharts). 7 columnas (lun-dom) × 5-6
// filas. Compatible con cualquier mes — los días previos al primer lunes
// del mes y posteriores al último día se rellenan vacíos para mantener la
// grilla rectangular.
import { useMemo } from 'react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { ChartCard } from './chart-card'
import { formatCOP, formatFechaCorta, mesActualISO } from '@renderer/lib/format'
import type { IpcResult, SerieDiariaFila } from '@shared/types'
import { cn } from '@renderer/lib/cn'

const NIVELES = 5 // 0..4 → tokens --color-heatmap-0..4
const DIAS_SEMANA_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

type Celda = {
  fecha: string | null
  ingresos: number
  transacciones: number
  nivel: number
  diaDelMes: number | null
}

/**
 * Calcula el nivel discreto de intensidad (0..4) para un valor dado contra
 * el máximo del set. 0 si el valor es 0 (no aplica el primer nivel a días
 * con datos pero menores). Cuando max es 0, todo es 0.
 */
function calcularNivel(valor: number, max: number): number {
  if (valor <= 0 || max <= 0) return 0
  // Distribución cuantil simple: 1=cuartil bajo, 4=cuartil alto.
  const ratio = valor / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export function HeatmapMensual({ mes }: { mes?: string } = {}): React.JSX.Element {
  const mesEfectivo = mes ?? mesActualISO()
  const { data, loading } = useIpc<SerieDiariaFila[]>(
    () =>
      window.api.finanzas
        .serieDiariaMensual(mesEfectivo)
        .then((r) => r as IpcResult<SerieDiariaFila[]>),
    [mesEfectivo]
  )

  const { celdas, totalMes, diaPico, maxIngresos } = useMemo(() => {
    if (!data || data.length === 0) {
      return { celdas: [], totalMes: 0, diaPico: null as Celda | null, maxIngresos: 0 }
    }
    // Math.max sobre array vacío devuelve `-Infinity` — no aplica aquí
    // porque ya guardamos `data.length === 0` arriba, pero blindamos por
    // si en el futuro se cambia la condición.
    const ingresosArr = data.map((d) => d.ingresos)
    const max = ingresosArr.length > 0 ? Math.max(...ingresosArr) : 0
    const total = data.reduce((s, d) => s + d.ingresos, 0)
    // Determina el día de la semana del primer día del mes (lunes=0..domingo=6)
    const primer = new Date(`${data[0]!.fecha}T12:00:00`)
    // getDay() devuelve 0=domingo..6=sábado. Convertimos a lunes=0..domingo=6.
    const offset = (primer.getDay() + 6) % 7

    const celdasCalc: Celda[] = []
    // Padding inicial
    for (let i = 0; i < offset; i++) {
      celdasCalc.push({
        fecha: null,
        ingresos: 0,
        transacciones: 0,
        nivel: 0,
        diaDelMes: null
      })
    }
    // Días reales
    for (const d of data) {
      const dia = Number(d.fecha.slice(8, 10))
      celdasCalc.push({
        fecha: d.fecha,
        ingresos: d.ingresos,
        transacciones: d.transacciones,
        nivel: calcularNivel(d.ingresos, max),
        diaDelMes: dia
      })
    }
    // Padding final para completar la última fila a múltiplo de 7
    while (celdasCalc.length % 7 !== 0) {
      celdasCalc.push({
        fecha: null,
        ingresos: 0,
        transacciones: 0,
        nivel: 0,
        diaDelMes: null
      })
    }

    const pico = data.reduce((acc, d) => (d.ingresos > acc.ingresos ? d : acc), data[0]!)
    return {
      celdas: celdasCalc,
      totalMes: total,
      diaPico:
        pico.ingresos > 0
          ? {
              fecha: pico.fecha,
              ingresos: pico.ingresos,
              transacciones: pico.transacciones,
              nivel: calcularNivel(pico.ingresos, max),
              diaDelMes: Number(pico.fecha.slice(8, 10))
            }
          : null,
      maxIngresos: max
    }
  }, [data])

  const isEmpty = !loading && totalMes === 0
  // Suprime warning si maxIngresos no se usa (lo tipamos para potencial expansión).
  void maxIngresos

  return (
    <ChartCard
      title="Actividad del mes"
      subtitle="Ingresos por día"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Aún no hay ingresos registrados este mes."
      contentHeight={260}
      footer={
        diaPico ? (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span>
              Día pico: <strong className="text-text">{formatFechaCorta(diaPico.fecha)}</strong> ·{' '}
              <span className="tabular-nums">{formatCOP(diaPico.ingresos)}</span>
            </span>
            <Leyenda />
          </div>
        ) : (
          <Leyenda />
        )
      }
    >
      <div className="space-y-2">
        {/* Header con días de la semana */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {DIAS_SEMANA_ES.map((d, i) => (
            <span key={i} className="text-xs font-medium text-text-soft">
              {d}
            </span>
          ))}
        </div>
        {/* Grilla de celdas */}
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((c, i) => {
            if (c.fecha === null) {
              return <div key={`empty-${i}`} aria-hidden="true" />
            }
            const titulo =
              c.ingresos > 0
                ? `${formatFechaCorta(c.fecha)} · ${formatCOP(c.ingresos)} · ${c.transacciones} ${c.transacciones === 1 ? 'transacción' : 'transacciones'}`
                : `${formatFechaCorta(c.fecha)} · sin actividad`
            return (
              <div
                key={c.fecha}
                title={titulo}
                role="img"
                aria-label={titulo}
                className={cn(
                  'aspect-square rounded flex items-end justify-end p-0.5 text-[10px] font-medium tabular-nums',
                  c.nivel === 0 ? 'text-text-soft' : 'text-text-muted'
                )}
                style={{ background: `var(--color-heatmap-${c.nivel})` }}
              >
                {c.diaDelMes}
              </div>
            )
          })}
        </div>
      </div>
    </ChartCard>
  )
}

function Leyenda(): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-text-soft">Menos</span>
      {Array.from({ length: NIVELES }).map((_, i) => (
        <span
          key={i}
          className="w-3 h-3 rounded-sm"
          style={{ background: `var(--color-heatmap-${i})` }}
          aria-hidden="true"
        />
      ))}
      <span className="text-xs text-text-soft">Más</span>
    </div>
  )
}
