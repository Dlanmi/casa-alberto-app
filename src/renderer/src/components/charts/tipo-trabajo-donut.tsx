// Donut chart de distribución de ingresos por categoría comercial.
// Mezcla tipos de trabajo de pedidos con clases, kits y contratos como
// categorías sintéticas. Total al centro del donut. Leyenda lateral con
// icono + label + monto + porcentaje.
import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Frame, GraduationCap, Palette, FileSignature, type LucideIcon } from 'lucide-react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useChartPeriod, type ChartPeriodKey } from '@renderer/hooks/use-chart-period'
import { ChartCard } from './chart-card'
import { ChartPeriodSelector } from './chart-period-selector'
import { formatCOP } from '@renderer/lib/format'
import { TIPO_TRABAJO_LABEL } from '@renderer/lib/constants'
import { TIPO_TRABAJO_ICON } from '@renderer/lib/iconography'
import type { IngresoPorTipoFila, IpcResult, TipoTrabajo } from '@shared/types'

const PERIODOS_DISPONIBLES: ChartPeriodKey[] = ['mes_actual', 'ultimos_3m', 'anio_actual', 'todo']

// Paleta del donut: cada slice rota entre los 6 tokens chart-* del theme.
// El array se itera circularmente cuando hay más categorías que colores.
const PALETA: string[] = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)'
]

// Etiqueta y icono para categorías sintéticas no-pedido.
const SINTETICOS: Record<'clases' | 'kits' | 'contratos', { label: string; icon: LucideIcon }> = {
  clases: { label: 'Clases', icon: GraduationCap },
  kits: { label: 'Kits de dibujo', icon: Palette },
  contratos: { label: 'Contratos', icon: FileSignature }
}

function labelDe(categoria: IngresoPorTipoFila['categoria']): string {
  if (categoria === 'clases' || categoria === 'kits' || categoria === 'contratos') {
    return SINTETICOS[categoria].label
  }
  return TIPO_TRABAJO_LABEL[categoria as TipoTrabajo] ?? categoria
}

function iconoDe(categoria: IngresoPorTipoFila['categoria']): LucideIcon {
  if (categoria === 'clases' || categoria === 'kits' || categoria === 'contratos') {
    return SINTETICOS[categoria].icon
  }
  return TIPO_TRABAJO_ICON[categoria as TipoTrabajo] ?? Frame
}

type RowChart = {
  categoria: IngresoPorTipoFila['categoria']
  label: string
  valor: number
  cantidad: number
  porcentaje: number
  color: string
  icono: LucideIcon
}

function CustomTooltip({
  active,
  payload
}: {
  active?: boolean
  payload?: { payload: RowChart }[]
}): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  const item = payload[0]!.payload
  return (
    <div className="rounded-md bg-surface px-3 py-2 text-sm shadow-2 border border-border">
      <p className="font-medium text-text mb-1">{item.label}</p>
      <p className="tabular-nums text-text-muted">
        {formatCOP(item.valor)} ·{' '}
        <span className="text-text font-medium">{item.porcentaje.toFixed(1)}%</span>
      </p>
      <p className="text-xs text-text-muted">
        {item.cantidad} {item.cantidad === 1 ? 'venta' : 'ventas'}
      </p>
    </div>
  )
}

export function TipoTrabajoDonut(): React.JSX.Element {
  const { period, setPeriod, desde, hasta } = useChartPeriod('mes_actual')
  const { data, loading } = useIpc<IngresoPorTipoFila[]>(
    () =>
      window.api.finanzas
        .ingresosPorTipoTrabajo({ desde, hasta })
        .then((r) => r as IpcResult<IngresoPorTipoFila[]>),
    [desde, hasta]
  )

  const { rows, total } = useMemo(() => {
    const lista = data ?? []
    const totalCalc = lista.reduce((s, f) => s + f.total, 0)
    const rowsCalc: RowChart[] = lista.map((f, i) => ({
      categoria: f.categoria,
      label: labelDe(f.categoria),
      valor: f.total,
      cantidad: f.cantidad,
      porcentaje: totalCalc > 0 ? (f.total / totalCalc) * 100 : 0,
      color: PALETA[i % PALETA.length]!,
      icono: iconoDe(f.categoria)
    }))
    return { rows: rowsCalc, total: totalCalc }
  }, [data])

  const isEmpty = !loading && rows.length === 0

  return (
    <ChartCard
      title="Distribución por tipo"
      subtitle="Ingresos por categoría"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Aún no hay ingresos en el período."
      contentHeight={300}
      controls={
        <ChartPeriodSelector value={period} onChange={setPeriod} options={PERIODOS_DISPONIBLES} />
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 items-center">
        <div className="relative" style={{ height: 260 }}>
          {rows.length === 1 ? (
            // Recharts PieChart con un solo slice renderiza un círculo "vacío"
            // (la donut shape requiere ≥2 segmentos para tener forma). Para
            // un solo categoria mostramos un anillo coloreado completo con
            // el total al centro — visualmente más claro y evita ambigüedad.
            <SingleCategoryRing color={rows[0]!.color} total={total} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="valor"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={1}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                >
                  {rows.map((r, i) => (
                    <Cell key={i} fill={r.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {/* Centro del donut con total — visible también en SingleCategoryRing */}
          {rows.length !== 1 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-text-muted">Total</span>
              <span className="text-lg font-bold text-text tabular-nums">{formatCOP(total)}</span>
            </div>
          )}
        </div>

        {/* Leyenda */}
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {rows.map((r) => {
            const Icon = r.icono
            return (
              <li
                key={r.categoria}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface-muted/40 min-h-10"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: r.color }}
                  aria-hidden="true"
                />
                <Icon size={16} className="text-text-soft shrink-0" aria-hidden="true" />
                <span className="text-sm text-text flex-1 truncate">{r.label}</span>
                <span className="text-sm font-medium text-text tabular-nums shrink-0">
                  {formatCOP(r.valor)}
                </span>
                <span className="text-xs text-text-muted tabular-nums shrink-0 w-12 text-right">
                  {r.porcentaje.toFixed(1)}%
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <table className="sr-only">
        <caption>Distribución de ingresos por categoría</caption>
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Total</th>
            <th>Porcentaje</th>
            <th>Ventas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.categoria}>
              <td>{r.label}</td>
              <td>{formatCOP(r.valor)}</td>
              <td>{r.porcentaje.toFixed(1)}%</td>
              <td>{r.cantidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  )
}

/** Anillo SVG estático para el caso de UNA sola categoría — Recharts Pie
 *  con un solo slice no se renderiza visualmente bien. Mantiene la misma
 *  presencia visual del donut completo y muestra el total al centro. */
function SingleCategoryRing({ color, total }: { color: string; total: number }): React.JSX.Element {
  // viewBox 120×120 con círculo r=40 strokeWidth=20 deja 10 px de margen
  // a cada lado. Antes con 100×100 el stroke tocaba los bordes y dependiendo
  // del rounding podía recortarse visualmente.
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg width="200" height="200" viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="20"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xs text-text-muted">Total</span>
        <span className="text-lg font-bold text-text tabular-nums">{formatCOP(total)}</span>
      </div>
    </div>
  )
}
