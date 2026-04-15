import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@renderer/components/ui/card'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { cn } from '@renderer/lib/cn'

type FinanceSummaryProps = {
  ingresos: number
  gastos: number
}

export function FinanceSummary({ ingresos, gastos }: FinanceSummaryProps) {
  const navigate = useNavigate()
  const balance = ingresos - gastos
  const positivo = balance >= 0

  const items = [
    {
      label: 'Ingresos del dia',
      value: ingresos,
      color: 'text-success',
      icon: TrendingUp
    },
    {
      label: 'Gastos del dia',
      value: gastos,
      color: 'text-error',
      icon: TrendingDown
    },
    {
      label: 'Balance',
      value: Math.abs(balance),
      color: positivo ? 'text-success' : 'text-error',
      icon: positivo ? TrendingUp : balance === 0 ? Minus : TrendingDown
    }
  ]

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text">Finanzas del Dia</h2>
        <button
          onClick={() => navigate('/finanzas')}
          className="text-sm text-accent hover:text-accent-hover cursor-pointer"
        >
          Ver resumen del mes
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon size={18} className={item.color} />
                <span className="text-sm text-text-muted">{item.label}</span>
              </div>
              <PrecioDisplay value={item.value} size="md" className={cn(item.color)} />
            </div>
          )
        })}
      </div>
    </Card>
  )
}
