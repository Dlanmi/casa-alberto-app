import { useState, useRef, useEffect } from 'react'
import { Search, Sparkles, X, UserPlus } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Modal } from '@renderer/components/ui/modal'
import { useDebounce } from '@renderer/hooks/use-debounce'
import { formatTelefono, iniciales } from '@renderer/lib/format'
import type { Cliente, IpcResult } from '@shared/types'

type ClientePickerProps = {
  value: Cliente | null
  onChange: (cliente: Cliente | null) => void
  label?: string
  error?: string
  className?: string
}

export function ClientePicker({
  value,
  onChange,
  label,
  error,
  className
}: ClientePickerProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Cliente[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [creatingMode, setCreatingMode] = useState(false)
  const [newNombre, setNewNombre] = useState('')
  const [newTelefono, setNewTelefono] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 200)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearching(false)
      return
    }
    setSearching(true)
    window.api.clientes
      .listar({
        busqueda: debouncedQuery,
        soloActivos: true,
        limit: 8
      })
      .then((res) => {
        const r = res as IpcResult<Cliente[]>
        if (r.ok) setResults(r.data)
      })
      .finally(() => setSearching(false))
  }, [debouncedQuery])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        resetCreateForm()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(cliente: Cliente): void {
    onChange(cliente)
    setQuery('')
    setResults([])
    setOpen(false)
    resetCreateForm()
  }

  function handleClear(): void {
    onChange(null)
    setQuery('')
    setResults([])
  }

  function resetCreateForm(): void {
    setCreatingMode(false)
    setNewNombre('')
    setNewTelefono('')
    setCreateError(null)
  }

  function enterCreateMode(): void {
    setNewNombre(query.trim())
    setCreatingMode(true)
  }

  async function handleQuickCreate(): Promise<void> {
    const nombre = newNombre.trim()
    if (!nombre) {
      setCreateError('El nombre es obligatorio')
      return
    }
    setCreateLoading(true)
    setCreateError(null)
    try {
      const result = (await window.api.clientes.crear({
        nombre,
        telefono: newTelefono.trim() || null,
        cedula: null,
        correo: null,
        direccion: null,
        notas: null,
        esMenor: false
      })) as IpcResult<Cliente>
      if (result.ok) {
        handleSelect(result.data)
      } else {
        setCreateError(result.error)
      }
    } catch {
      setCreateError('No se pudo crear el cliente')
    } finally {
      setCreateLoading(false)
    }
  }

  if (value) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && <label className="text-sm font-medium text-text">{label}</label>}
        <div className="rounded-lg border border-border bg-surface px-4 py-3 shadow-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent-strong">
              {iniciales(value.nombre)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{value.nombre}</p>
              <p className="text-xs text-text-muted">
                {[value.cedula, value.telefono ? formatTelefono(value.telefono) : null]
                  .filter(Boolean)
                  .join(' · ') || 'Cliente listo para continuar'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text cursor-pointer transition-colors"
              aria-label="Cambiar cliente"
            >
              <X size={16} />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2">
            <Sparkles size={14} className="shrink-0 text-accent-strong" />
            <p className="text-xs text-text-muted">
              Este cliente quedará listo para continuar a pedido, factura y seguimiento.
            </p>
          </div>
        </div>
        {error && <p className="text-xs text-error-strong">{error}</p>}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && <label className="text-sm font-medium text-text">{label}</label>}
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-soft"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (e.target.value.trim().length < 2) {
              setResults([])
            }
            setOpen(true)
            if (creatingMode) resetCreateForm()
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar cliente por nombre, cédula o teléfono..."
          className={cn(
            'h-12 w-full rounded-md border border-border bg-surface pl-10 pr-3 text-sm text-text',
            'placeholder:text-text-soft',
            'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent',
            error && 'border-error'
          )}
        />
      </div>
      {/* Modal para crear cliente nuevo — separado del dropdown para evitar
          que el formulario tape el contenido debajo del picker */}
      <Modal open={creatingMode} onClose={resetCreateForm} title="Crear cliente nuevo" size="sm">
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={newNombre}
            onChange={(e) => {
              setNewNombre(e.target.value)
              if (createError) setCreateError(null)
            }}
            placeholder="Nombre del cliente"
            error={createError && !newNombre.trim() ? createError : undefined}
          />
          <Input
            label="Teléfono (opcional)"
            value={newTelefono}
            onChange={(e) => setNewTelefono(e.target.value)}
            placeholder="Ej: 3101234567"
          />
          {createError && newNombre.trim() && (
            <p className="text-xs text-error-strong">{createError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button
              size="lg"
              onClick={handleQuickCreate}
              disabled={createLoading}
              className="flex-1"
            >
              {createLoading ? 'Creando...' : 'Crear y seleccionar'}
            </Button>
            <Button variant="outline" size="lg" onClick={resetCreateForm} disabled={createLoading}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {open && !creatingMode && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-3">
          {searching ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-[min(16rem,60vh)] overflow-y-auto py-1">
              {results.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-muted"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent-strong">
                    {iniciales(c.nombre)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{c.nombre}</p>
                    <p className="text-xs text-text-muted">
                      {[c.cedula, formatTelefono(c.telefono)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1 px-3 py-2">
                <button
                  type="button"
                  onClick={enterCreateMode}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-accent-strong hover:bg-surface-muted"
                >
                  <UserPlus size={16} />
                  Crear cliente nuevo
                </button>
              </div>
            </div>
          ) : query.trim().length >= 2 ? (
            <div className="px-4 py-4">
              <p className="text-sm font-medium text-text">No encontramos coincidencias</p>
              <p className="text-xs text-text-muted mb-3">
                Si es un cliente nuevo, puedes crearlo aquí mismo.
              </p>
              <button
                type="button"
                onClick={enterCreateMode}
                className="flex cursor-pointer items-center gap-2 rounded-md bg-accent/10 px-3 py-2.5 text-sm font-medium text-accent-strong hover:bg-accent/20"
              >
                <UserPlus size={16} />
                Crear &ldquo;{query.trim()}&rdquo; como cliente nuevo
              </button>
            </div>
          ) : (
            <div className="px-4 py-4">
              <p className="text-sm font-medium text-text">Empieza a escribir</p>
              <p className="text-xs text-text-muted">
                Con dos letras o más te mostraremos coincidencias activas.
              </p>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-error-strong">{error}</p>}
    </div>
  )
}
