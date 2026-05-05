// Chart "Top Marcos Vendidos" — barras horizontales con doble métrica:
// la barra muestra cantidad de pedidos que usaron el marco, y a la derecha
// el total facturado. Útil para que el dueño identifique referencias que
// reordenar a tiempo.
import { useMemo } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useChartPeriod, type ChartPeriodKey } from '@renderer/hooks/use-chart-period'
import { ChartCard } from './chart-card'
import { ChartPeriodSelector } from './chart-period-selector'
import { formatCOP } from '@renderer/lib/format'
import type { IpcResult, TopMarcoFila } from '@shared/types'

const PERIODOS_DISPONIBLES: ChartPeriodKey[] = ['mes_actual', 'ultimos_3m', 'anio_actual', 'todo']

const LIMIT_DEFAULT = 5

type RowChart = TopMarcoFila

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
      <p className="font-medium text-text mb-1 font-mono">{item.referencia}</p>
      <p className="tabular-nums text-text-muted">
        {item.cantidad} {item.cantidad === 1 ? 'pedido' : 'pedidos'}
      </p>
      <p className="tabular-nums text-text-muted">
        Total: <span className="text-text font-medium">{formatCOP(item.total)}</span>
      </p>
    </div>
  )
}

export function TopMarcosChart(): React.JSX.Element {
  const { period, setPeriod, desde, hasta } = useChartPeriod('mes_actual')
  const { data, loading } = useIpc<TopMarcoFila[]>(
    () =>
      window.api.finanzas
        .topMarcosVendidos({ desde, hasta, limit: LIMIT_DEFAULT })
        .then((r) => r as IpcResult<TopMarcoFila[]>),
    [desde, hasta]
  )

  const rows: RowChart[] = useMemo(() => data ?? [], [data])
  const isEmpty = !loading && rows.length === 0
  const totalGeneral = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows])

  return (
    <ChartCard
      title="Top marcos vendidos"
      subtitle="Referencias más pedidas"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Aún no hay pedidos con marco en el período."
      contentHeight={Math.max(rows.length, 3) * 44 + 40}
      controls={
        <ChartPeriodSelector value={period} onChange={setPeriod} options={PERIODOS_DISPONIBLES} />
      }
      footer={
        rows.length > 0 ? (
          <div className="flex items-center justify-between">
            <span>
              {rows.length} {rows.length === 1 ? 'referencia' : 'referencias'}
            </span>
            <span className="tabular-nums">
              Total facturado: <strong className="text-text">{formatCOP(totalGeneral)}</strong>
            </span>
          </div>
        ) : null
      }
    >
      <ResponsiveContainer width="100%" height={Math.max(rows.length, 3) * 44 + 40}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--color-text-soft)' }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="referencia"
            axisLine={false}
            tickLine={false}
            width={120}
            tick={{ fontSize: 12, fill: 'var(--color-text)', fontFamily: 'monospace' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-muted)' }} />
          <Bar dataKey="cantidad" radius={[0, 4, 4, 0]}>
            {rows.map((_, index) => (
              <Cell key={index} fill="var(--color-accent)" fillOpacity={1 - index * 0.12} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <table className="sr-only">
        <caption>Top {rows.length} marcos por cantidad vendida</caption>
        <thead>
          <tr>
            <th>Referencia</th>
            <th>Cantidad</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.referencia}>
              <td>{r.referencia}</td>
              <td>{r.cantidad}</td>
              <td>{formatCOP(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  )
}
