import { cn } from '@renderer/lib/cn'
import { formatCOP } from '@renderer/lib/format'
import { EMOJI_CATEGORIA_FINANZAS } from '@renderer/lib/emojis'
import { useEmojis } from '@renderer/contexts/emojis-context'
import type { CategoriaMovimiento } from '@shared/types'

type CategoriaItem = { categoria: string; tipo: string; total: number }

const CATEGORIA_LABEL: Record<string, string> = {
  enmarcacion: 'Enmarcación',
  clases: 'Clases',
  kit_dibujo: 'Kit de dibujo',
  contratos: 'Contratos',
  restauracion: 'Restauración',
  materiales: 'Materiales',
  servicios: 'Servicios',
  transporte: 'Transporte',
  arriendo: 'Arriendo',
  devolucion: 'Devolución',
  otro: 'Otro'
}

function BarRow({
  label,
  value,
  max,
  tone
}: {
  label: string
  value: number
  max: number
  tone: 'success' | 'error'
}): React.JSX.Element {
  const { enabled: emojisEnabled } = useEmojis()
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  const emoji = EMOJI_CATEGORIA_FINANZAS[label as CategoriaMovimiento]
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 sm:w-28 shrink-0 truncate text-sm text-text-muted">
        {emojisEnabled && emoji && (
          <span aria-hidden="true" className="mr-1">
            {emoji}
          </span>
        )}
        {CATEGORIA_LABEL[label] ?? label}
      </span>
      <div className="flex-1 h-5 rounded-sm bg-surface-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-sm transition-[width] duration-500',
            tone === 'success' ? 'bg-success/20' : 'bg-error/20'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          'w-24 shrink-0 text-right text-sm font-medium tabular-nums',
          tone === 'success' ? 'text-success' : 'text-error'
        )}
      >
        {formatCOP(value)}
      </span>
    </div>
  )
}

export function CategoryBreakdown({
  porCategoria,
  totalIngresos,
  totalGastos
}: {
  porCategoria: CategoriaItem[]
  totalIngresos: number
  totalGastos: number
}): React.JSX.Element | null {
  const ingresos = porCategoria
    .filter((c) => c.tipo === 'ingreso' && c.total > 0)
    .sort((a, b) => b.total - a.total)
  const gastos = porCategoria
    .filter((c) => c.tipo === 'gasto' && c.total > 0)
    .sort((a, b) => b.total - a.total)

  if (ingresos.length === 0 && gastos.length === 0) return null

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {ingresos.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">
            Ingresos por categoría
          </p>
          <div className="space-y-2">
            {ingresos.map((c) => (
              <BarRow
                key={c.categoria}
                label={c.categoria}
                value={c.total}
                max={totalIngresos}
                tone="success"
              />
            ))}
          </div>
        </div>
      )}
      {gastos.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">
            Gastos por categoría
          </p>
          <div className="space-y-2">
            {gastos.map((c) => (
              <BarRow
                key={c.categoria}
                label={c.categoria}
                value={c.total}
                max={totalGastos}
                tone="error"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
