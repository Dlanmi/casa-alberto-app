// Chart "Mes vs Mes" — barras agrupadas de ingresos vs gastos por mes.
// Pensado para que el dueño vea de un vistazo si el negocio mejora o empeora.
//
// Período: 3, 6 o 12 meses (selector). Usa el provider serieMensual del
// backend que ya rellena meses sin movimientos con ceros — el chart no
// tiene que normalizar nada.
import { useState, useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useIpc } from '@renderer/hooks/use-ipc'
import type { IpcResult, SerieMensualFila } from '@shared/types'
import { ChartCard } from './chart-card'
import { formatCOP, formatCOPCorto, mesCorto } from '@renderer/lib/format'

type Ventana = 3 | 6 | 12

const OPCIONES_VENTANA: { ventana: Ventana; label: string }[] = [
  { ventana: 3, label: '3m' },
  { ventana: 6, label: '6m' },
  { ventana: 12, label: '12m' }
]

type RowChart = {
  mes: string
  mesLabel: string
  ingresos: number
  gastos: number
  balance: number
}

function CustomTooltip({
  active,
  payload,
  label
}: {
  active?: boolean
  payload?: { payload: RowChart }[]
  label?: string
}): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  const item = payload[0]!.payload
  return (
    <div className="rounded-md bg-surface px-3 py-2 text-sm shadow-2 border border-border">
      <p className="font-medium text-text mb-1">{mesCorto(item.mes, true)}</p>
      <p className="tabular-nums">
        <span className="text-text-muted">Ingresos: </span>
        <span className="text-success-strong font-medium">{formatCOP(item.ingresos)}</span>
      </p>
      <p className="tabular-nums">
        <span className="text-text-muted">Gastos: </span>
        <span className="text-error-strong font-medium">{formatCOP(item.gastos)}</span>
      </p>
      <p className="tabular-nums border-t border-border mt-1 pt-1">
        <span className="text-text-muted">Balance: </span>
        <span
          className={
            item.balance >= 0 ? 'text-success-strong font-medium' : 'text-error-strong font-medium'
          }
        >
          {formatCOP(item.balance)}
        </span>
      </p>
      {/* `label` viene de XAxis y solo se usa si futureamente lo necesitamos.
          Lo referenciamos para satisfacer el lint sin renderizar nada. */}
      {label === '' && null}
    </div>
  )
}

export function MesVsMesChart(): React.JSX.Element {
  const [ventana, setVentana] = useState<Ventana>(6)
  const { data, loading } = useIpc<SerieMensualFila[]>(
    () => window.api.finanzas.serieMensual(ventana).then((r) => r as IpcResult<SerieMensualFila[]>),
    [ventana]
  )

  const rows: RowChart[] = useMemo(() => {
    if (!data) return []
    return data.map((f) => ({
      mes: f.mes,
      // Para series de >=12 meses anotamos el año en cada label para evitar
      // ambigüedad. Para 6m, sólo enero — la heurística de mesCorto.
      mesLabel: mesCorto(f.mes, ventana >= 12),
      ingresos: f.ingresos,
      gastos: f.gastos,
      balance: f.balance
    }))
  }, [data, ventana])

  const isEmpty =
    !loading && rows.length > 0 && rows.every((r) => r.ingresos === 0 && r.gastos === 0)

  return (
    <ChartCard
      title="Ingresos vs Gastos"
      subtitle="Comparativo mensual"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Aún no hay movimientos en el período."
      contentHeight={280}
      controls={
        <div
          role="tablist"
          aria-label="Ventana de meses"
          className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-surface-muted border border-border"
        >
          {OPCIONES_VENTANA.map((o) => {
            const active = o.ventana === ventana
            return (
              <button
                key={o.ventana}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setVentana(o.ventana)}
                className={
                  'px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer min-h-8 ' +
                  (active ? 'bg-surface text-text shadow-1' : 'text-text-muted hover:text-text')
                }
              >
                {o.label}
              </button>
            )
          })}
        </div>
      }
      footer={
        rows.length > 0 ? (
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: 'var(--color-success)' }}
                aria-hidden="true"
              />
              Ingresos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ background: 'var(--color-error)' }}
                aria-hidden="true"
              />
              Gastos
            </span>
          </div>
        ) : null
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={4}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="mesLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--color-text-soft)' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={56}
            tick={{ fontSize: 11, fill: 'var(--color-text-soft)' }}
            tickFormatter={(v: number) => formatCOPCorto(v)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-muted)' }} />
          <Legend wrapperStyle={{ display: 'none' }} />
          <Bar
            dataKey="ingresos"
            name="Ingresos"
            fill="var(--color-success)"
            radius={[4, 4, 0, 0]}
          />
          <Bar dataKey="gastos" name="Gastos" fill="var(--color-error)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Tabla accesible (sr-only) — permite que screen readers lean los
          datos reales en lugar del chart visual. */}
      <table className="sr-only">
        <caption>Ingresos y gastos por mes</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Ingresos</th>
            <th>Gastos</th>
            <th>Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mes}>
              <td>{mesCorto(r.mes, true)}</td>
              <td>{formatCOP(r.ingresos)}</td>
              <td>{formatCOP(r.gastos)}</td>
              <td>{formatCOP(r.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  )
}
