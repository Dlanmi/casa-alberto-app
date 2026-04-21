import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HelpCircle, X } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { getHelpForRoute } from '@renderer/lib/help-content'

// Fase 4 — Botón flotante de ayuda contextual. Siempre visible abajo a la
// derecha. Click abre un popover con 3-5 tips pensados para papá (60 años)
// sobre la página actual. No es un tour global — es ayuda puntual.
export function HelpButton(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const content = getHelpForRoute(location.pathname)

  // Cierra al cambiar de ruta para no dejar tips de otra pantalla visibles.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setOpen(false)
  }, [location.pathname, open])

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
          className="fixed bottom-22 right-6 z-40 w-[min(360px,calc(100vw-3rem))] rounded-lg border border-border bg-surface shadow-4 animate-slide-in-right"
        >
          <div className="border-b border-border px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
              Ayuda rápida
            </p>
            <h3 className="mt-1 text-base font-semibold text-text">{content.heading}</h3>
          </div>
          <ul className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4">
            {content.tips.map((tip, index) => (
              <li key={`${tip.title}-${index}`} className="space-y-1">
                <p className="text-sm font-semibold text-text">{tip.title}</p>
                <p className="text-sm leading-relaxed text-text-muted">{tip.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
