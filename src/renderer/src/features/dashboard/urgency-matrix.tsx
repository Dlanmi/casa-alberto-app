import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, CircleDollarSign, CheckCircle } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { Card } from '@renderer/components/ui/card'
import { useMatrizUrgencia } from '@renderer/hooks/use-matriz-urgencia'

// AGENT_UX + AGENT_BIZ: Matriz operativa 2x2 (urgencia x pago).
// Los cuadrantes vienen del backend via useMatrizUrgencia() (BR-001) para
// garantizar consistencia con cualquier otra vista que necesite los mismos
// conteos. Cada cuadrante navega a /pedidos?focus=... con el filtro aplicado.

type QuadrantFilter = 'urgente_sin_abono' | 'sin_abono' | 'proximos' | 'requiere_accion'

type Quadrant = {
  label: string
  sublabel: string
  count: number
  color: 'error' | 'warning' | 'success' | 'neutral'
  icon: typeof AlertTriangle
  filter: QuadrantFilter
}

export function UrgencyMatrix(): React.JSX.Element {
  const navigate = useNavigate()
  const { data: matriz, loading } = useMatrizUrgencia(2)

  const urgenteSinAbono = matriz?.urgenteSinAbono ?? 0
  const urgenteConAbono = matriz?.urgenteConAbono ?? 0
  const normalSinAbono = matriz?.normalSinAbono ?? 0
  const normalConAbono = matriz?.normalConAbono ?? 0
  const atrasados = matriz?.atrasados ?? 0

  const quadrants: Quadrant[] = [
    {
      label: 'Urgente sin pago',
      sublabel: 'Atender primero',
      count: urgenteSinAbono,
      color: urgenteSinAbono > 0 ? 'error' : 'neutral',
      icon: AlertTriangle,
      filter: 'urgente_sin_abono'
    },
    {
      label: 'Próximos a entregar',
      sublabel: 'En 2 días o menos',
      count: urgenteConAbono,
      color: urgenteConAbono > 0 ? 'warning' : 'neutral',
      icon: Clock,
      filter: 'proximos'
    },
    {
      label: 'Pendiente de pago',
      sublabel: 'Revisa antes de producir',
      count: normalSinAbono,
      color: normalSinAbono > 0 ? 'warning' : 'neutral',
      icon: CircleDollarSign,
      filter: 'sin_abono'
    },
    {
      label: 'En buen estado',
      sublabel: 'Sin acción inmediata',
      count: normalConAbono,
      color: normalConAbono > 0 ? 'success' : 'neutral',
      icon: CheckCircle,
      filter: 'requiere_accion'
    }
  ]

  const colorClasses: Record<Quadrant['color'], string> = {
    error: 'bg-error-bg border-error/25 text-error-strong hover:border-error/60',
    warning: 'bg-warning-bg border-warning/25 text-warning-strong hover:border-warning/60',
    success: 'bg-success-bg border-success/25 text-success-strong hover:border-success/60',
    neutral: 'bg-surface-muted border-border text-text-soft hover:border-border-strong'
  }

  const iconBgClasses: Record<Quadrant['color'], string> = {
    error: 'bg-error/15',
    warning: 'bg-warning/15',
    success: 'bg-success/15',
    neutral: 'bg-border/40'
  }

  return (
    <Card padding="md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-soft">
            Tablero del día
          </p>
          <h2 className="text-lg font-semibold text-text">Pedidos activos</h2>
        </div>
        <button
          onClick={() => navigate('/pedidos')}
          className="cursor-pointer text-sm font-medium text-accent-strong hover:text-accent"
        >
          Ver todos →
        </button>
      </div>

      {atrasados > 0 && (
        <button
          onClick={() => navigate('/pedidos?focus=atrasados')}
          className="mb-4 flex w-full cursor-pointer items-center gap-3 rounded-md border border-error/25 bg-error-bg px-4 py-3 text-left transition-colors hover:bg-error/10"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-error/15">
            <AlertTriangle size={18} className="text-error-strong" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-error-strong">
              {atrasados} pedido{atrasados > 1 ? 's' : ''} atrasado{atrasados > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-error-strong/80">
              Entrarán a la vista filtrada de atrasados al hacer clic.
            </p>
          </div>
          <span aria-hidden className="text-error-strong">
            →
          </span>
        </button>
      )}

      {/* 2x2 matrix */}
      <div className={cn('grid grid-cols-2 gap-3 transition-opacity', loading && 'opacity-60')}>
        {quadrants.map((q) => {
          const Icon = q.icon
          const disabled = q.count === 0
          return (
            <button
              key={q.filter}
              onClick={() => navigate(`/pedidos?focus=${q.filter}`)}
              disabled={disabled}
              aria-label={`${q.label}: ${q.count}`}
              className={cn(
                'group flex min-h-37 flex-col items-start gap-3 rounded-lg border-2 p-5 text-left transition-all duration-200',
                colorClasses[q.color],
                !disabled && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-2',
                disabled && 'opacity-60 cursor-default'
              )}
            >
              <div className="flex w-full items-center justify-between">
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-full transition-transform',
                    iconBgClasses[q.color],
                    !disabled && 'group-hover:scale-110'
                  )}
                >
                  <Icon size={22} />
                </div>
                {!disabled && (
                  <span
                    aria-hidden
                    className="text-xl font-bold opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    →
                  </span>
                )}
              </div>
              <div>
                <p className="text-4xl font-bold leading-none tabular-nums">{q.count}</p>
                <p className="mt-2 text-sm font-semibold">{q.label}</p>
                <p className="text-xs opacity-80">{q.sublabel}</p>
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
