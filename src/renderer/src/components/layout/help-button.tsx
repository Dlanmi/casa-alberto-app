import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  X
} from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import {
  getHelpForRoute,
  HELP_FAQ,
  HELP_ROUTES,
  resolveDynamicTips
} from '@renderer/lib/help-content'
import type {
  HelpAction,
  HelpActionItem,
  HelpContext,
  HelpFaq,
  HelpTip
} from '@renderer/lib/help-content'
import { whatsappUrl } from '@renderer/lib/whatsapp'
import { useMatrizUrgencia } from '@renderer/hooks/use-matriz-urgencia'
import { useStatsGenerales } from '@renderer/hooks/use-stats-generales'
import { usePedidosSinAbono } from '@renderer/hooks/use-pedidos-sin-abono'
import { useEntregasHoy } from '@renderer/hooks/use-entregas-hoy'
import { useEntregasSemana } from '@renderer/hooks/use-entregas-semana'
import { useIpc } from '@renderer/hooks/use-ipc'
import type { Proveedor } from '@shared/types'
import { resetWelcomeTour } from './welcome-tour'

// Fase 4 — Botón flotante de ayuda contextual. v1.5.0 hace el popover
// verdaderamente inteligente: tips dinámicos con datos reales (matriz de
// urgencia), toggle Tips/FAQ, y búsqueda global que incluye ambos.
const MIN_QUERY_LEN = 2
const MAX_SEARCH_RESULTS = 10

type SearchTipHit = {
  kind: 'tip'
  tip: HelpTip
  prefix: string
  heading: string
}

type SearchFaqHit = {
  kind: 'faq'
  faq: HelpFaq
}

type SearchHit = SearchTipHit | SearchFaqHit

type ActiveTab = 'tips' | 'faq'

export function HelpButton(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<ActiveTab>('tips')
  const [expandedFaqIdx, setExpandedFaqIdx] = useState<number | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const content = getHelpForRoute(location.pathname)

  // Contexto para tips dinámicos. Cada hook cachea su resultado con el
  // mismo IPC, así que abrir el popover en varias rutas no duplica queries.
  const { data: matriz, refetch: refetchMatriz } = useMatrizUrgencia()
  const { data: stats, refetch: refetchStats } = useStatsGenerales()
  const { data: proveedores, refetch: refetchProveedores } = useIpc<Proveedor[]>(
    () => window.api.proveedores.listar({ soloActivos: true }),
    []
  )
  const { data: deudores, refetch: refetchDeudores } = usePedidosSinAbono(5)
  const { data: entregasHoy, refetch: refetchEntregasHoy } = useEntregasHoy()
  const { data: entregasSemana, refetch: refetchEntregasSemana } = useEntregasSemana()
  const ctx = useMemo<HelpContext>(
    () => ({ matriz, stats, proveedores, deudores, entregasHoy, entregasSemana }),
    [matriz, stats, proveedores, deudores, entregasHoy, entregasSemana]
  )
  const dynamicTips = useMemo(() => resolveDynamicTips(content, ctx), [content, ctx])

  // Auto-refresh al abrir el popover: garantiza datos frescos cada vez que
  // papá consulta la ayuda. El hook cachea por defecto, pero las acciones
  // externas (pagos, movimientos) pueden haber cambiado los contadores.
  useEffect(() => {
    if (!open) return
    refetchMatriz()
    refetchStats()
    refetchProveedores()
    refetchDeudores()
    refetchEntregasHoy()
    refetchEntregasSemana()
  }, [
    open,
    refetchMatriz,
    refetchStats,
    refetchProveedores,
    refetchDeudores,
    refetchEntregasHoy,
    refetchEntregasSemana
  ])

  // Cierra al cambiar de ruta para no dejar tips de otra pantalla visibles.
  // Reset del popover al cambiar de ruta. Intencionalmente omitimos `open`
  // y los setters de deps: no queremos re-disparar al abrir (eso causó el
  // bug de v1.4.0 donde el popover se cerraba solo al abrirse). Las reglas
  // react-hooks/set-state-in-effect y exhaustive-deps están apagadas para
  // este archivo en eslint.config.mjs.
  useEffect(() => {
    setOpen(false)
    setQuery('')
    setTab('tips')
    setExpandedFaqIdx(null)
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

  // Búsqueda global: barre tips de todas las rutas + FAQs. Case insensitive,
  // substring match sobre title/description (tips) y question/steps/tags (faqs).
  const searchHits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < MIN_QUERY_LEN) return []
    const hits: SearchHit[] = []

    // Tips primero (tienden a ser respuestas cortas útiles).
    for (const route of HELP_ROUTES) {
      for (const tip of route.content.tips) {
        const haystack = `${tip.title} ${tip.description}`.toLowerCase()
        if (haystack.includes(q)) {
          hits.push({ kind: 'tip', tip, prefix: route.prefix, heading: route.content.heading })
          if (hits.length >= MAX_SEARCH_RESULTS) return hits
        }
      }
    }

    // Luego FAQs (respuestas largas paso a paso).
    for (const faq of HELP_FAQ) {
      const haystack = [faq.question, ...faq.steps, ...(faq.tags ?? [])].join(' ').toLowerCase()
      if (haystack.includes(q)) {
        hits.push({ kind: 'faq', faq })
        if (hits.length >= MAX_SEARCH_RESULTS) return hits
      }
    }

    return hits
  }, [query])

  const isSearching = query.trim().length >= MIN_QUERY_LEN

  function handleNavigate(to: string): void {
    navigate(to)
    setOpen(false)
  }

  // Despacha una acción de un actionItem. Siempre cierra el popover
  // después para que papá vuelva al contexto donde estaba actuando.
  function handleAction(action: HelpAction): void {
    if (action.kind === 'navigate') {
      handleNavigate(action.to)
    } else if (action.kind === 'call') {
      const clean = action.tel.replace(/\D/g, '')
      if (clean.length >= 7) {
        window.location.href = `tel:${clean}`
      }
      setOpen(false)
    } else if (action.kind === 'whatsapp') {
      const url = whatsappUrl(action.tel, action.mensaje)
      if (url) {
        void window.api.shell.openExternal(url)
      }
      setOpen(false)
    }
  }

  function handleResetTour(): void {
    setOpen(false)
    resetWelcomeTour()
  }

  function toggleFaq(index: number): void {
    setExpandedFaqIdx((curr) => (curr === index ? null : index))
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
          className="fixed bottom-22 right-6 z-40 w-[min(400px,calc(100vw-3rem))] rounded-lg border border-border bg-surface shadow-4 animate-slide-in-right flex flex-col max-h-[75vh]"
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

          {!isSearching && (
            <div className="border-b border-border px-5 py-2">
              <div
                className="inline-flex rounded-md border border-border bg-surface-muted p-0.5"
                role="tablist"
                aria-label="Secciones de ayuda"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'tips'}
                  onClick={() => setTab('tips')}
                  className={cn(
                    'px-3 py-1 text-sm font-medium rounded-sm cursor-pointer transition-colors',
                    tab === 'tips'
                      ? 'bg-surface text-text shadow-1'
                      : 'text-text-muted hover:text-text'
                  )}
                >
                  Tips
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'faq'}
                  onClick={() => setTab('faq')}
                  className={cn(
                    'px-3 py-1 text-sm font-medium rounded-sm cursor-pointer transition-colors',
                    tab === 'faq'
                      ? 'bg-surface text-text shadow-1'
                      : 'text-text-muted hover:text-text'
                  )}
                >
                  Preguntas comunes
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isSearching ? (
              <SearchResults hits={searchHits} query={query.trim()} onNavigate={handleNavigate} />
            ) : tab === 'tips' ? (
              <TipsList
                dynamicTips={dynamicTips}
                staticTips={content.tips}
                onNavigate={handleNavigate}
                onAction={handleAction}
              />
            ) : (
              <FaqList
                expandedIdx={expandedFaqIdx}
                onToggle={toggleFaq}
                onNavigate={handleNavigate}
              />
            )}
          </div>

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

// ---------------------------------------------------------------------------
// Subcomponentes internos para mantener el render principal legible.
// ---------------------------------------------------------------------------

function TipsList({
  dynamicTips,
  staticTips,
  onNavigate,
  onAction
}: {
  dynamicTips: HelpTip[]
  staticTips: HelpTip[]
  onNavigate: (to: string) => void
  onAction: (action: HelpAction) => void
}): React.JSX.Element {
  return (
    <ul className="space-y-4">
      {dynamicTips.map((tip, index) => (
        <li
          key={`dyn-${index}`}
          className="rounded-md border border-accent/30 bg-accent/5 p-3 space-y-2"
        >
          <p className="text-sm font-semibold text-accent-strong">{tip.title}</p>
          <p className="text-sm leading-relaxed text-text">{tip.description}</p>
          {tip.actionItems && tip.actionItems.length > 0 && (
            <ActionItemsList items={tip.actionItems} onAction={onAction} />
          )}
          {tip.to && !tip.actionItems && (
            <NavButton to={tip.to} onNavigate={onNavigate} label="Ver ahora" />
          )}
        </li>
      ))}
      {staticTips.map((tip, index) => (
        <li key={`st-${index}`} className="space-y-1">
          <p className="text-sm font-semibold text-text">{tip.title}</p>
          <p className="text-sm leading-relaxed text-text-muted">{tip.description}</p>
          {tip.to && <NavButton to={tip.to} onNavigate={onNavigate} label="Ir ahí" />}
        </li>
      ))}
    </ul>
  )
}

// Lista de items con acciones (llamar, WhatsApp, navegar). Renderizado
// compacto: label arriba, sublabel debajo, botones alineados a la derecha.
function ActionItemsList({
  items,
  onAction
}: {
  items: HelpActionItem[]
  onAction: (action: HelpAction) => void
}): React.JSX.Element {
  return (
    <ul className="mt-1 space-y-2 divide-y divide-border/60">
      {items.map((item, i) => (
        <li key={i} className="pt-2 first:pt-0">
          <p className="text-sm font-medium text-text">{item.label}</p>
          {item.sublabel && <p className="mt-0.5 text-xs text-text-muted">{item.sublabel}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {item.actions.map((action, j) => (
              <ActionButton key={j} action={action} onAction={onAction} />
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}

function ActionButton({
  action,
  onAction
}: {
  action: HelpAction
  onAction: (action: HelpAction) => void
}): React.JSX.Element {
  const icon =
    action.kind === 'call' ? (
      <Phone size={14} />
    ) : action.kind === 'whatsapp' ? (
      <MessageCircle size={14} />
    ) : (
      <ArrowRight size={14} />
    )
  const ariaLabel =
    action.kind === 'call'
      ? `Llamar al ${action.tel}`
      : action.kind === 'whatsapp'
        ? `Abrir WhatsApp para ${action.tel}`
        : action.label
  return (
    <button
      type="button"
      onClick={() => onAction(action)}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text hover:border-accent/50 hover:text-accent-strong cursor-pointer transition-colors"
    >
      {icon}
      {action.label}
    </button>
  )
}

function FaqList({
  expandedIdx,
  onToggle,
  onNavigate
}: {
  expandedIdx: number | null
  onToggle: (index: number) => void
  onNavigate: (to: string) => void
}): React.JSX.Element {
  return (
    <ul className="space-y-2">
      {HELP_FAQ.map((faq, index) => {
        const isOpen = expandedIdx === index
        return (
          <li key={faq.question} className="rounded-md border border-border bg-surface-muted">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => onToggle(index)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left cursor-pointer"
            >
              <span className="text-sm font-medium text-text">{faq.question}</span>
              {isOpen ? (
                <ChevronUp size={16} className="shrink-0 text-text-muted" />
              ) : (
                <ChevronDown size={16} className="shrink-0 text-text-muted" />
              )}
            </button>
            {isOpen && (
              <div className="border-t border-border px-3 py-3 bg-surface">
                <ol className="space-y-2 list-decimal pl-5 text-sm leading-relaxed text-text-muted">
                  {faq.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                {faq.relatedRoute && (
                  <div className="mt-3">
                    <NavButton
                      to={faq.relatedRoute}
                      onNavigate={onNavigate}
                      label="Ir a esa sección"
                    />
                  </div>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function SearchResults({
  hits,
  query,
  onNavigate
}: {
  hits: SearchHit[]
  query: string
  onNavigate: (to: string) => void
}): React.JSX.Element {
  if (hits.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        No encontramos nada con “{query}”. Prueba otras palabras.
      </p>
    )
  }
  return (
    <ul className="space-y-4">
      {hits.map((hit, index) =>
        hit.kind === 'tip' ? (
          <li key={`tip-${hit.prefix}-${index}`} className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-soft">
              {hit.heading}
            </p>
            <p className="text-sm font-semibold text-text">{hit.tip.title}</p>
            <p className="text-sm leading-relaxed text-text-muted">{hit.tip.description}</p>
            {hit.tip.to && <NavButton to={hit.tip.to} onNavigate={onNavigate} label="Ir ahí" />}
          </li>
        ) : (
          <li key={`faq-${index}`} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-text-soft">
              Pregunta común
            </p>
            <p className="text-sm font-semibold text-text">{hit.faq.question}</p>
            <ol className="space-y-1 list-decimal pl-5 text-sm leading-relaxed text-text-muted">
              {hit.faq.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            {hit.faq.relatedRoute && (
              <NavButton
                to={hit.faq.relatedRoute}
                onNavigate={onNavigate}
                label="Ir a esa sección"
              />
            )}
          </li>
        )
      )}
    </ul>
  )
}

function NavButton({
  to,
  onNavigate,
  label
}: {
  to: string
  onNavigate: (to: string) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onNavigate(to)}
      className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent-strong hover:text-accent cursor-pointer"
    >
      {label}
      <ArrowRight size={14} />
    </button>
  )
}
