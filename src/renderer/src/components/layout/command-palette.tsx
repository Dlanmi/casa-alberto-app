import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { Spinner } from '@renderer/components/ui/spinner'
import { useDebounce } from '@renderer/hooks/use-debounce'
import {
  agruparPorSeccion,
  aplanar,
  ejecutarProviders,
  type CommandProvider,
  type CommandResult
} from './command-providers'

type CommandPaletteProps = {
  open: boolean
  onClose: () => void
  // Providers inyectados por el AppShell. El palette no los crea ni los
  // ordena — solo los ejecuta y renderiza. Esto deja la composición de
  // providers (entidades + acciones + recientes) en un solo lugar.
  providers: CommandProvider[]
}

const TITLE_ID = 'command-palette-title'
const DESCRIPTION_ID = 'command-palette-description'
const LISTBOX_ID = 'command-palette-results'

export function CommandPalette({
  open,
  onClose,
  providers
}: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [grupos, setGrupos] = useState<{ seccion: string; items: CommandResult[] }[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const debouncedQuery = useDebounce(query, 200)
  const navigate = useNavigate()

  // Lista plana en orden visual — usada por las flechas y para Enter.
  const resultadosPlanos = useMemo(() => aplanar(grupos), [grupos])
  const selectedOptionId = useMemo(
    () => (resultadosPlanos[selected] ? `command-palette-option-${resultadosPlanos[selected].id}` : undefined),
    [resultadosPlanos, selected]
  )

  // Reset al abrir / restaurar foco al cerrar.
  useEffect(() => {
    if (open) {
      lastFocusedRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      setQuery('')
      setGrupos([])
      setSelected(0)
      const timerId = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timerId)
    }
    lastFocusedRef.current?.focus()
    return undefined
  }, [open])

  // Búsqueda — invoca todos los providers en paralelo. Cada provider decide
  // cuándo devolver resultados (algunos sólo con query, otros también vacío
  // para mostrar acciones top o recientes).
  useEffect(() => {
    if (!open) return
    let cancelado = false
    async function ejecutar(): Promise<void> {
      setSearching(true)
      try {
        const resultados = await ejecutarProviders(providers, debouncedQuery)
        if (cancelado) return
        const agrupados = agruparPorSeccion(resultados)
        setGrupos(agrupados)
        setSelected(0)
      } finally {
        if (!cancelado) setSearching(false)
      }
    }
    void ejecutar()
    return () => {
      cancelado = true
    }
  }, [debouncedQuery, providers, open])

  function handleSelect(result: CommandResult): void {
    // Defensa: si el `ejecutar` de un provider tira (ej. callback que falla,
    // navigate con ruta inválida), igual cerramos el palette para que el
    // usuario no quede atrapado. Logueamos para debug.
    try {
      result.ejecutar({ navigate: (path) => navigate(path), cerrar: onClose })
    } catch (err) {
      console.error(`CommandPalette: ejecutar "${result.id}" falló:`, err)
      onClose()
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((current) => Math.min(current + 1, resultadosPlanos.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && resultadosPlanos[selected]) {
      handleSelect(resultadosPlanos[selected])
    } else if (event.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  // Calcula el offset del índice global para cada sección — necesario para
  // pintar la selección correcta cuando los resultados están agrupados.
  let visualIndex = 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[clamp(3rem,15vh,20vh)]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={DESCRIPTION_ID}
        className="relative w-140 max-w-[90vw] bg-surface rounded-xl border border-border shadow-4 overflow-hidden animate-fade-in-up"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sr-only">
          <h2 id={TITLE_ID}>Búsqueda global</h2>
          <p id={DESCRIPTION_ID}>
            Busca clientes, pedidos, facturas, proveedores, clases, contratos y ejecuta acciones
            rápidas con el teclado.
          </p>
        </div>

        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search size={20} className="text-text-soft shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar o ejecutar una acción…"
            className="h-14 flex-1 text-base bg-transparent outline-none text-text placeholder:text-text-soft"
            role="combobox"
            aria-expanded={resultadosPlanos.length > 0}
            aria-autocomplete="list"
            aria-controls={LISTBOX_ID}
            aria-activedescendant={selectedOptionId}
          />
        </div>

        {searching && resultadosPlanos.length === 0 && (
          <div className="flex items-center justify-center py-6" aria-busy="true">
            <Spinner size="sm" />
          </div>
        )}

        {grupos.length > 0 && (
          <div
            id={LISTBOX_ID}
            role="listbox"
            aria-label="Resultados de búsqueda"
            className="max-h-96 overflow-y-auto py-2"
          >
            {grupos.map((grupo) => (
              <div key={grupo.seccion} className="pb-1">
                <div className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {grupo.seccion}
                </div>
                {grupo.items.map((result) => {
                  const Icon = result.icono
                  // Guarda paranoica: si un provider devuelve un item sin
                  // icono (ej. kind corrupto que se coló), no rompemos el
                  // render — descartamos el item silenciosamente. El store
                  // y el provider ya filtran este caso; esto es la última
                  // capa de defense-in-depth contra el bug del informe.
                  if (!Icon) return null
                  const optionId = `command-palette-option-${result.id}`
                  const isSelected = visualIndex === selected
                  const myIndex = visualIndex
                  visualIndex += 1
                  return (
                    <button
                      key={optionId}
                      id={optionId}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelected(myIndex)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer min-h-12',
                        isSelected ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                      )}
                    >
                      <Icon size={18} className="text-text-soft shrink-0" aria-hidden="true" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text truncate">{result.titulo}</p>
                        {result.subtitulo && (
                          <p className="text-xs text-text-muted truncate">{result.subtitulo}</p>
                        )}
                      </div>
                      {result.shortcut && (
                        <kbd className="hidden sm:inline-block text-xs font-medium text-text-muted bg-surface-muted border border-border rounded px-1.5 py-0.5">
                          {result.shortcut}
                        </kbd>
                      )}
                      <ArrowRight
                        size={14}
                        className="text-text-soft shrink-0"
                        aria-hidden="true"
                      />
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {query.length >= 2 && grupos.length === 0 && !searching && (
          <div className="py-8 text-center text-sm text-text-muted">
            No se encontraron resultados.
          </div>
        )}

        {/* Footer con tip de teclado — visible siempre que el palette está abierto.
            Refuerza el descubrimiento de Esc, flechas y Enter sin saturar. */}
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-border bg-surface-muted/40 text-xs text-text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-medium">↑↓</kbd> navegar
            </span>
            <span>
              <kbd className="font-medium">Enter</kbd> seleccionar
            </span>
            <span>
              <kbd className="font-medium">Esc</kbd> cerrar
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
