import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCOP } from '@renderer/lib/format'

type BarChartMiniProps = {
  ingresos: number
  gastos: number
  height?: number
}

type ChartItem = {
  label: string
  valor: number
  color: string
}

function CustomTooltip({
  active,
  payload
}: {
  active?: boolean
  payload?: { payload: ChartItem }[]
}): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-md bg-surface px-3 py-2 text-sm shadow-2 border border-border">
      <p className="font-medium text-text">{item.label}</p>
      <p className="tabular-nums text-text-muted">{formatCOP(item.valor)}</p>
    </div>
  )
}

export function BarChartMini({
  ingresos,
  gastos,
  height = 160
}: BarChartMiniProps): React.JSX.Element {
  const data: ChartItem[] = [
    { label: 'Ingresos', valor: ingresos, color: '#047857' },
    { label: 'Gastos', valor: gastos, color: '#b42318' }
  ]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barSize={40} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: '#78716f' }}
        />
        <YAxis hide />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.label} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
