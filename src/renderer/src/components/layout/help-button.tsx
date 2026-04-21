import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, HelpCircle, RotateCcw, Search, X } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { getHelpForRoute, HELP_ROUTES } from '@renderer/lib/help-content'
import type { HelpTip } from '@renderer/lib/help-content'
import { resetWelcomeTour } from './welcome-tour'

// Fase 4 — Botón flotante de ayuda contextual. Siempre visible abajo a la
// derecha. Click abre un popover con 3-5 tips pensados para papá (60 años)
// sobre la página actual. v1.4.1 agrega búsqueda global, tips con navegación
// directa y acceso al tour de bienvenida.
const MIN_QUERY_LEN = 2
const MAX_SEARCH_RESULTS = 10

type SearchHit = { tip: HelpTip; prefix: string; heading: string }

export function HelpButton(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const content = getHelpForRoute(location.pathname)

  // Cierra al cambiar de ruta para no dejar tips de otra pantalla visibles.
  // Intencionalmente omitimos `open` de deps: no queremos re-disparar al abrir
  // (eso causó el bug de v1.4.0 donde el popover se cerraba solo al abrirse).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery('')
  }, [location.pathname])

  // Cierra al hacer clic fuera del popover o presionar Escape.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent): void {
      const target = e.target as Node
      if (popoverRef.current?.contains(target)) return
      if (buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Resultados de búsqueda global. Solo activo con query ≥2 chars; si no,
  // el popover muestra los tips de la ruta actual (comportamiento original).
  const searchHits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < MIN_QUERY_LEN) return []
    const hits: SearchHit[] = []
    for (const route of HELP_ROUTES) {
      for (const tip of route.content.tips) {
        const haystack = `${tip.title} ${tip.description}`.toLowerCase()
        if (haystack.includes(q)) {
          hits.push({ tip, prefix: route.prefix, heading: route.content.heading })
          if (hits.length >= MAX_SEARCH_RESULTS) return hits
        }
      }
    }
    return hits
  }, [query])

  const isSearching = query.trim().length >= MIN_QUERY_LEN
  const visibleTips = isSearching ? searchHits : null

  function handleNavigate(to: string): void {
    navigate(to)
    setOpen(false)
  }

  function handleResetTour(): void {
    setOpen(false)
    resetWelcomeTour()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-tour="help-button"
        aria-label={open ? 'Cerrar ayuda' : 'Abrir ayuda'}
        aria-expanded={open}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-3 transition-all cursor-pointer',
          'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
          open
            ? 'bg-accent-strong text-white hover:bg-accent'
            : 'bg-accent text-white hover:bg-accent-strong'
        )}
        title="Ayuda sobre esta pantalla"
      >
        {open ? <X size={22} /> : <HelpCircle size={22} />}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Ayuda: ${content.heading}`}
          className="fixed bottom-22 right-6 z-40 w-[min(380px,calc(100vw-3rem))] rounded-lg border border-border bg-surface shadow-4 animate-slide-in-right flex flex-col max-h-[70vh]"
        >
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
              Ayuda rápida
            </p>
            <h3 className="mt-1 text-base font-semibold text-text">
              {isSearching ? 'Resultados de búsqueda' : content.heading}
            </h3>
          </div>

          <div className="border-b border-border px-5 py-3">
            <label className="relative block">
              <span className="sr-only">Buscar ayuda</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en toda la ayuda..."
                className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
              />
            </label>
          </div>

          <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {isSearching ? (
              visibleTips && visibleTips.length > 0 ? (
                visibleTips.map((hit, index) => (
                  <li key={`${hit.prefix}-${hit.tip.title}-${index}`} className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-text-soft">
                      {hit.heading}
                    </p>
                    <p className="text-sm font-semibold text-text">{hit.tip.title}</p>
                    <p className="text-sm leading-relaxed text-text-muted">{hit.tip.description}</p>
                    {hit.tip.to && (
                      <button
                        type="button"
                        onClick={() => handleNavigate(hit.tip.to!)}
                        className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent-strong hover:text-accent cursor-pointer"
                      >
                        Ir ahí
                        <ArrowRight size={14} />
                      </button>
                    )}
                  </li>
                ))
              ) : (
                <li className="text-sm text-text-muted">
                  No encontramos nada con “{query.trim()}”. Prueba otras palabras.
                </li>
              )
            ) : (
              content.tips.map((tip, index) => (
                <li key={`${tip.title}-${index}`} className="space-y-1">
                  <p className="text-sm font-semibold text-text">{tip.title}</p>
                  <p className="text-sm leading-relaxed text-text-muted">{tip.description}</p>
                  {tip.to && (
                    <button
                      type="button"
                      onClick={() => handleNavigate(tip.to!)}
                      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent-strong hover:text-accent cursor-pointer"
                    >
                      Ir ahí
                      <ArrowRight size={14} />
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>

          <div className="border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={handleResetTour}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text cursor-pointer"
            >
              <RotateCcw size={14} />
              Ver el tour de bienvenida otra vez
            </button>
          </div>
        </div>
      )}
    </>
  )
}
