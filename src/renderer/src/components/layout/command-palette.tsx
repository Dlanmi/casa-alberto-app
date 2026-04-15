import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, ClipboardList, Receipt, ArrowRight } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { Spinner } from '@renderer/components/ui/spinner'
import { useDebounce } from '@renderer/hooks/use-debounce'
import { formatTelefono } from '@renderer/lib/format'
import type { Cliente, Factura, IpcResult, Pedido } from '@shared/types'

type SearchResult =
  | { type: 'cliente'; data: Cliente }
  | { type: 'pedido'; data: Pedido }
  | { type: 'factura'; data: Factura }

type CommandPaletteProps = {
  open: boolean
  onClose: () => void
}

function getResultTitle(result: SearchResult): string {
  if (result.type === 'cliente') return result.data.nombre
  if (result.type === 'pedido') {
    return `${result.data.numero} — ${result.data.descripcion ?? 'Sin descripción'}`
  }

  return result.data.numero
}

function getResultSubtitle(result: SearchResult): string {
  if (result.type === 'cliente') {
    return result.data.telefono ? `Cliente · ${formatTelefono(result.data.telefono)}` : 'Cliente'
  }

  if (result.type === 'pedido') return 'Pedido'
  return 'Factura'
}

export function CommandPalette({ open, onClose }: CommandPaletteProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const debouncedQuery = useDebounce(query, 200)
  const navigate = useNavigate()

  const titleId = 'command-palette-title'
  const descriptionId = 'command-palette-description'
  const listboxId = 'command-palette-results'
  const selectedOptionId = useMemo(
    () =>
      results[selected]
        ? `command-palette-option-${results[selected].type}-${results[selected].data.id}`
        : undefined,
    [results, selected]
  )

  useEffect(() => {
    if (open) {
      lastFocusedRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      setQuery('')
      setResults([])
      setSelected(0)
      const timerId = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timerId)
    }

    lastFocusedRef.current?.focus()
    return undefined
  }, [open])

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([])
      return
    }

    async function search(): Promise<void> {
      setSearching(true)
      try {
        const [clientesRes, pedidosRes, facturasRes] = (await Promise.all([
          window.api.clientes.listar({ busqueda: debouncedQuery, limit: 5 }),
          window.api.pedidos.listar({ limit: 5 }),
          window.api.facturas.listar({ limit: 5 })
        ])) as [IpcResult<Cliente[]>, IpcResult<Pedido[]>, IpcResult<Factura[]>]

        const items: SearchResult[] = []
        const normalizedQuery = debouncedQuery.toLowerCase()

        if (clientesRes.ok) {
          items.push(
            ...clientesRes.data.map((cliente) => ({ type: 'cliente' as const, data: cliente }))
          )
        }

        if (pedidosRes.ok) {
          pedidosRes.data
            .filter(
              (pedido) =>
                pedido.numero.toLowerCase().includes(normalizedQuery) ||
                pedido.descripcion?.toLowerCase().includes(normalizedQuery)
            )
            .forEach((pedido) => items.push({ type: 'pedido', data: pedido }))
        }

        if (facturasRes.ok) {
          facturasRes.data
            .filter((factura) => factura.numero.toLowerCase().includes(normalizedQuery))
            .forEach((factura) => items.push({ type: 'factura', data: factura }))
        }

        setResults(items.slice(0, 10))
        setSelected(0)
      } catch (err) {
        console.error('Command palette search failed:', err)
        setResults([])
      } finally {
        setSearching(false)
      }
    }

    search()
  }, [debouncedQuery])

  function handleSelect(result: SearchResult): void {
    switch (result.type) {
      case 'cliente':
        navigate(`/clientes/${result.data.id}`)
        break
      case 'pedido':
        navigate(`/pedidos/${result.data.id}`)
        break
      case 'factura':
        navigate(`/facturas/${result.data.id}`)
        break
      default:
        break
    }

    onClose()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((current) => Math.min(current + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && results[selected]) {
      handleSelect(results[selected])
    } else if (event.key === 'Escape') {
      onClose()
    }
  }

  if (!open) return null

  const iconMap = {
    cliente: Users,
    pedido: ClipboardList,
    factura: Receipt
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[clamp(3rem,15vh,20vh)]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-140 max-w-[90vw] bg-surface rounded-xl border border-border shadow-4 overflow-hidden animate-fade-in-up"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sr-only">
          <h2 id={titleId}>Búsqueda global</h2>
          <p id={descriptionId}>Busca clientes, pedidos y facturas con el teclado.</p>
        </div>

        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search size={20} className="text-text-soft shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar cliente, pedido o factura…"
            className="h-14 flex-1 text-base bg-transparent outline-none text-text placeholder:text-text-soft"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-activedescendant={selectedOptionId}
          />
        </div>

        {searching && results.length === 0 && (
          <div className="flex items-center justify-center py-6" aria-busy="true">
            <Spinner size="sm" />
          </div>
        )}

        {results.length > 0 && (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Resultados de búsqueda"
            className="max-h-80 overflow-y-auto py-2"
          >
            {results.map((result, index) => {
              const Icon = iconMap[result.type]
              const optionId = `command-palette-option-${result.type}-${result.data.id}`

              return (
                <button
                  key={optionId}
                  id={optionId}
                  role="option"
                  aria-selected={index === selected}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelected(index)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left cursor-pointer',
                    index === selected ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                  )}
                >
                  <Icon size={18} className="text-text-soft shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">{getResultTitle(result)}</p>
                    <p className="text-xs text-text-muted">{getResultSubtitle(result)}</p>
                  </div>
                  <ArrowRight size={14} className="text-text-soft shrink-0" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && !searching && (
          <div className="py-8 text-center text-sm text-text-muted">
            No se encontraron resultados.
          </div>
        )}
      </div>
    </div>
  )
}
