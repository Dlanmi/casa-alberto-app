// Picker de muestra de marco — componente compartido entre el wizard del
// cotizador y el pedido directo. Antes vivía solo dentro de step-marco.tsx;
// se extrajo para que ambos flujos usen la misma búsqueda + grid de
// tarjetas y la misma carga vía window.api.cotizador.listarMuestrasMarcos().
//
// El renderer envuelve `MuestraMarcoPicker` cuando ya tiene la lista
// pre-cargada (caso del wizard); el `MuestraMarcoPickerCargado` también
// hace el fetch automático para callers que no quieren pasar `marcos`.
import { useState } from 'react'
import { Check, Frame, Scissors, Ruler } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { SearchInput } from '@renderer/components/ui/search-input'
import { Badge } from '@renderer/components/ui/badge'
import { formatCOP } from '@renderer/lib/format'
import { useIpc } from '@renderer/hooks/use-ipc'
import type { MuestraMarcoConProveedor } from '@shared/types'

type Props = {
  marcos: MuestraMarcoConProveedor[]
  selectedId: number | null
  onSelect: (marco: MuestraMarcoConProveedor) => void
  /** Si se omite, el placeholder default es "Buscar marco (ej: M-001, dorado)...". */
  placeholder?: string
  /** Compacto: para usar dentro de un form pequeño (ej. pedido directo).
   *  En modo compacto: max-h con scroll, grid 1 col, sin headings. */
  compacto?: boolean
}

export function MuestraMarcoPicker({
  marcos,
  selectedId,
  onSelect,
  placeholder = 'Buscar marco (ej: M-001, dorado)...',
  compacto = false
}: Props): React.JSX.Element {
  const [search, setSearch] = useState('')

  const filtered = search
    ? marcos.filter(
        (m) =>
          m.referencia.toLowerCase().includes(search.toLowerCase()) ||
          m.descripcion?.toLowerCase().includes(search.toLowerCase())
      )
    : marcos

  return (
    <div>
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch('')}
        placeholder={placeholder}
        className={cn('mb-2', compacto ? 'max-w-full' : 'max-w-md')}
      />

      {!compacto && (
        <p className="text-xs text-text-muted mb-4">
          {filtered.length} de {marcos.length} marcos
        </p>
      )}

      {marcos.length === 0 && !search && (
        <div className="text-center py-8 text-text-muted">
          <p className="text-sm">No hay marcos configurados. Agrégalos en Configuración.</p>
        </div>
      )}

      <div
        className={cn(
          'grid gap-3 p-1',
          compacto
            ? 'grid-cols-1 max-h-72 overflow-y-auto'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        )}
      >
        {filtered.map((marco) => {
          const selected = selectedId === marco.id
          return (
            <button
              key={marco.id}
              type="button"
              onClick={() => onSelect(marco)}
              aria-pressed={selected}
              className={cn(
                'group relative flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all cursor-pointer',
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
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-colors',
                  selected
                    ? 'bg-accent text-white'
                    : 'bg-accent/10 text-accent-strong group-hover:bg-accent/20'
                )}
              >
                <Frame size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block truncate font-mono text-sm font-semibold tracking-tight text-text">
                  {marco.referencia}
                </span>
                {marco.descripcion && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">
                    {marco.descripcion}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
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

      {filtered.length === 0 && marcos.length > 0 && (
        <p className="text-sm text-text-muted text-center py-6">
          No se encontraron marcos con &ldquo;{search}&rdquo;.
        </p>
      )}
    </div>
  )
}

/**
 * Variante que carga la lista por sí sola via IPC. Útil en pedido directo
 * y otros lugares donde no se tiene la lista pre-cargada como en el wizard.
 */
export function MuestraMarcoPickerCargado(
  props: Omit<Props, 'marcos'>
): React.JSX.Element {
  const { data: marcos, loading } = useIpc<MuestraMarcoConProveedor[]>(
    () => window.api.cotizador.listarMuestrasMarcos(),
    []
  )

  if (loading) {
    return <p className="text-sm text-text-muted text-center py-6">Cargando marcos…</p>
  }

  return <MuestraMarcoPicker {...props} marcos={marcos ?? []} />
}
