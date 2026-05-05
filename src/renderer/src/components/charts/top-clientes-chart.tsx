// Chart "Top Clientes" — barras horizontales de clientes ordenados por
// monto total facturado en el período. Click en una barra navega al
// detalle del cliente.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useChartPeriod, type ChartPeriodKey } from '@renderer/hooks/use-chart-period'
import { ChartCard } from './chart-card'
import { ChartPeriodSelector } from './chart-period-selector'
import { formatCOP, formatCOPCorto, formatTelefono } from '@renderer/lib/format'
import type { IpcResult, TopClienteFila } from '@shared/types'

const PERIODOS_DISPONIBLES: ChartPeriodKey[] = ['mes_actual', 'ultimos_3m', 'anio_actual', 'todo']

const LIMIT_DEFAULT = 5
const MAX_LABEL_LEN = 24

function truncar(s: string, max = MAX_LABEL_LEN): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + '…'
}

type RowChart = {
  clienteId: number
  nombre: string
  nombreVisible: string
  total: number
  facturas: number
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
    <div className="rounded-md bg-surface px-3 py-2 text-sm shadow-2 border border-border max-w-xs">
      <p className="font-medium text-text mb-1">{item.nombre}</p>
      <p className="tabular-nums text-text-muted">
        Total: <span className="text-text font-medium">{formatCOP(item.total)}</span>
      </p>
      <p className="tabular-nums text-text-muted">
        {item.facturas} {item.facturas === 1 ? 'factura' : 'facturas'}
      </p>
      <p className="text-xs text-accent-strong mt-1">Click para ver el cliente</p>
    </div>
  )
}

// Suprime warning de variable no usada — `formatTelefono` se importa para
// que esté disponible si futureamente queremos mostrarlo en el tooltip.
void formatTelefono

export function TopClientesChart(): React.JSX.Element {
  const navigate = useNavigate()
  const { period, setPeriod, desde, hasta } = useChartPeriod('anio_actual')
  const { data, loading } = useIpc<TopClienteFila[]>(
    () =>
      window.api.finanzas
        .topClientes({ desde, hasta, limit: LIMIT_DEFAULT })
        .then((r) => r as IpcResult<TopClienteFila[]>),
    [desde, hasta]
  )

  const rows: RowChart[] = useMemo(
    () =>
      (data ?? []).map((f) => ({
        clienteId: f.clienteId,
        nombre: f.nombre,
        nombreVisible: truncar(f.nombre),
        total: f.total,
        facturas: f.facturas
      })),
    [data]
  )

  const isEmpty = !loading && rows.length === 0

  return (
    <ChartCard
      title="Top clientes"
      subtitle="Por monto facturado"
      loading={loading}
      isEmpty={isEmpty}
      emptyMessage="Aún no hay facturas en el período."
      contentHeight={Math.max(rows.length, 3) * 44 + 40}
      controls={
        <ChartPeriodSelector value={period} onChange={setPeriod} options={PERIODOS_DISPONIBLES} />
      }
    >
      <ResponsiveContainer width="100%" height={Math.max(rows.length, 3) * 44 + 40}>
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: 'var(--color-text-soft)' }}
            tickFormatter={(v: number) => formatCOPCorto(v)}
          />
          <YAxis
            type="category"
            dataKey="nombreVisible"
            axisLine={false}
            tickLine={false}
            width={140}
            tick={{ fontSize: 12, fill: 'var(--color-text)' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-muted)' }} />
          <Bar
            dataKey="total"
            radius={[0, 4, 4, 0]}
            cursor="pointer"
            onClick={(payload: unknown) => {
              // Recharts pasa el datum como `payload` (no por índice).
              // Leer `clienteId` directo evita races si `rows` se filtra
              // entre el render y el click.
              if (
                payload &&
                typeof payload === 'object' &&
                'clienteId' in payload &&
                typeof (payload as { clienteId: unknown }).clienteId === 'number'
              ) {
                navigate(`/clientes/${(payload as { clienteId: number }).clienteId}`)
              }
            }}
          >
            {rows.map((_, index) => (
              <Cell key={index} fill="var(--color-info)" fillOpacity={1 - index * 0.12} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <table className="sr-only">
        <caption>Top {rows.length} clientes por monto facturado</caption>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Total</th>
            <th>Facturas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.clienteId}>
              <td>{r.nombre}</td>
              <td>{formatCOP(r.total)}</td>
              <td>{r.facturas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  )
}
