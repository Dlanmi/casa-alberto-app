import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@renderer/components/ui/card'
import { formatCOP } from '@renderer/lib/format'
import type { LucideIcon } from 'lucide-react'

type KpiItem = {
  label: string
  value: string
  icon: LucideIcon
  trend?: number
}

type KpiCardsProps = {
  ingresos: number
  gastos: number
  balance: number
  pedidosActivos: number
}

// Delay entre cada KPI card en el stagger de entrada. 4 cards × 50ms = 200ms
// total, bajo el budget de 500ms (regla 1/3 del motion design).
const KPI_STAGGER_MS = 50

export function KpiCards({ ingresos, gastos, balance, pedidosActivos }: KpiCardsProps) {
  const items: KpiItem[] = [
    {
      label: 'Ingresos del mes',
      value: formatCOP(ingresos),
      icon: TrendingUp
    },
    {
      label: 'Gastos del mes',
      value: formatCOP(gastos),
      icon: TrendingDown
    },
    {
      label: 'Ganancia',
      value: formatCOP(balance),
      icon: balance >= 0 ? TrendingUp : TrendingDown
    },
    {
      label: 'Pedidos activos',
      value: String(pedidosActivos),
      icon: Minus
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <Card
            key={item.label}
            padding="md"
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * KPI_STAGGER_MS}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="h-9 w-9 flex items-center justify-center rounded-md bg-accent/10">
                <Icon size={18} className="text-accent" />
              </div>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-text mb-1">{item.value}</p>
            <p className="text-xs font-medium uppercase tracking-wider text-text-soft">
              {item.label}
            </p>
          </Card>
        )
      })}
    </div>
  )
}
