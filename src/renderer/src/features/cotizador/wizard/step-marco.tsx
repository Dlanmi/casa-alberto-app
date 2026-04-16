import { useState } from 'react'
import { Check, Frame, Scissors, Ruler } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { SearchInput } from '@renderer/components/ui/search-input'
import { Badge } from '@renderer/components/ui/badge'
import { formatCOP } from '@renderer/lib/format'
import type { MuestraMarco } from '@shared/types'
import type { WizardData } from './wizard-shell'

type Props = {
  data: WizardData
  onChange: (partial: Partial<WizardData>) => void
  marcos: MuestraMarco[]
}

export function StepMarco({ data, onChange, marcos }: Props): React.JSX.Element {
  const [search, setSearch] = useState('')

  const filtered = search
    ? marcos.filter(
        (m) =>
          m.referencia.toLowerCase().includes(search.toLowerCase()) ||
          m.descripcion?.toLowerCase().includes(search.toLowerCase())
      )
    : marcos

  function selectMarco(marco: MuestraMarco): void {
    onChange({ muestraMarcoId: marco.id, muestraMarco: marco })
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-1">Seleccionar marco</h2>
      <p className="text-sm text-text-muted mb-4">
        El cliente escoge la muestra. Cada referencia tiene colilla y precio por metro.
      </p>

      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch('')}
        placeholder="Buscar marco (ej: M-001, dorado)..."
        className="mb-2 max-w-md"
      />

      <p className="text-xs text-text-muted mb-4">
        {filtered.length} de {marcos.length} marcos
      </p>

      {marcos.length === 0 && !search && (
        <div className="text-center py-12 text-text-muted">
          <p className="text-sm">No hay marcos configurados. Agrégalos en Configuración.</p>
        </div>
      )}

      {/* AGENT_UX: Tarjetas de marco con icono Frame, referencia en mono,
          colilla como badge, precio destacado, checkmark redondeado en
          selección. Antes eran pure-text rows — ahora son escaneables. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
        {filtered.map((marco) => {
          const selected = data.muestraMarcoId === marco.id
          return (
            <button
              key={marco.id}
              onClick={() => selectMarco(marco)}
              aria-pressed={selected}
              className={cn(
                'group relative flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all cursor-pointer',
                selected
                  ? 'border-accent bg-accent/5 shadow-2'
                  : 'border-border bg-surface hover:border-accent/50 hover:shadow-1 hover:-translate-y-0.5'
              )}
            >
              {selected && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white shadow-1">
                  <Check size={14} strokeWidth={3} />
                </div>
              )}
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors',
                  selected
                    ? 'bg-accent text-white'
                    : 'bg-accent/10 text-accent-strong group-hover:bg-accent/20'
                )}
              >
                <Frame size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block truncate font-mono text-sm font-semibold tracking-tight text-text">
                  {marco.referencia}
                </span>
                {marco.descripcion && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{marco.descripcion}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge color="neutral" size="sm" icon={Scissors}>
                    {marco.colillaCm} cm
                  </Badge>
                  <span className="inline-flex items-center gap-1 rounded-sm bg-accent/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-accent-strong">
                    <Ruler size={12} />
                    {formatCOP(marco.precioMetro)}/m
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-text-muted text-center py-8">No se encontraron marcos.</p>
      )}
    </div>
  )
}
