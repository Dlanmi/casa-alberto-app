import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'

// Tipos de entidad reconocidos en el historial reciente del CommandPalette.
// Solo agregamos tipos cuya página detalle es deep-linkable. Si en el futuro
// se agrega una ruta `/clases/:id`, basta con extender este array — el
// union, el type guard, los Record<RecentEntityKind, ...> y los tests se
// derivan automáticamente.
export const RECENT_ENTITY_KINDS = ['cliente', 'pedido', 'factura', 'contrato'] as const
export type RecentEntityKind = (typeof RECENT_ENTITY_KINDS)[number]

// Type guard runtime — protege contra payloads corruptos en localStorage
// (kind arbitrario que pase el typeof === 'string'). Sin este guard, el
// CommandPalette intenta renderizar `<Icon />` con Icon=undefined y la UI
// queda blanca. Patrón análogo a `validarEnum()` en src/main/lib.
export function isRecentEntityKind(value: unknown): value is RecentEntityKind {
  return typeof value === 'string' && (RECENT_ENTITY_KINDS as readonly string[]).includes(value)
}

export type RecentEntity = {
  kind: RecentEntityKind
  id: number
  titulo: string
  subtitulo?: string
  // ISO timestamp del último acceso. Permite ordenar y eventualmente caducar.
  visitedAt: string
}

const STORAGE_KEY = 'casa-alberto:palette-recent'
// Cap del historial — protege ante crecimiento descontrolado en localStorage.
// 20 es suficiente para mostrar top 5 con margen de filtros futuros.
const MAX_ENTRIES = 20

// Mapa ruta → kind: cuando el usuario navega a `/clientes/:id`, registramos
// un acceso a un cliente. Centralizado para que agregar una ruta detalle
// requiera solo una entrada nueva.
const ROUTE_TO_KIND: Array<{ pattern: RegExp; kind: RecentEntityKind }> = [
  { pattern: /^\/clientes\/(\d+)$/, kind: 'cliente' },
  { pattern: /^\/pedidos\/(\d+)$/, kind: 'pedido' },
  { pattern: /^\/facturas\/(\d+)$/, kind: 'factura' },
  { pattern: /^\/contratos\/(\d+)$/, kind: 'contrato' }
]

// -- Store singleton ---------------------------------------------------------
// Usamos un store externo (módulo-level) para que múltiples instancias del
// hook compartan el mismo estado. useSyncExternalStore garantiza re-render
// en cualquier consumer cuando la lista cambia, sin necesidad de Context.

type Listener = () => void

function leerStorage(): RecentEntity[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      // localStorage tenía algo, pero no es array — formato inesperado.
      // Logueamos y limpiamos para que el siguiente write lo reemplace.
      console.warn(
        `[recientes] formato inválido en localStorage (esperaba array, recibió ${typeof parsed}). Reseteando.`
      )
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignorar */
      }
      return []
    }
    return parsed
      .filter(
        (e): e is RecentEntity =>
          e &&
          typeof e === 'object' &&
          // Whitelist contra el union — un kind arbitrario rompe el render
          // del palette al indexar ICONO_POR_KIND con clave inexistente.
          isRecentEntityKind(e.kind) &&
          typeof e.id === 'number' &&
          // Filtra IDs no-positivos: no existen entidades con id<=0 en la DB.
          // Ver detectarRuta — también valida ahí.
          e.id > 0 &&
          typeof e.titulo === 'string'
      )
      .slice(0, MAX_ENTRIES)
  } catch (err) {
    // JSON.parse tiró — el contenido está corrupto. Lo reportamos en consola
    // (no usamos toast aquí porque el hook puede invocarse pre-mount) y
    // limpiamos el slot para que el próximo write empiece fresh.
    console.warn(
      `[recientes] localStorage corrupto, limpiando: ${err instanceof Error ? err.message : err}`
    )
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignorar */
    }
    return []
  }
}

let cache: RecentEntity[] = leerStorage()
const listeners = new Set<Listener>()

function notify(): void {
  for (const l of listeners) l()
}

function escribir(entries: RecentEntity[]): void {
  cache = entries
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    }
  } catch {
    // Si localStorage está lleno o bloqueado, ignoramos — no es crítico.
  }
  notify()
}

function suscribir(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

function snapshot(): RecentEntity[] {
  return cache
}

// Lectura directa del store (sin React) — para consumers que no son
// componentes (ej. el provider de recientes del CommandPalette, que necesita
// la lista actual cada vez que se invoca, sin causar re-render del shell).
export function getRecentEntitiesSnapshot(): RecentEntity[] {
  return cache
}

function agregarStore(entity: Omit<RecentEntity, 'visitedAt'>): void {
  // Defensa: TypeScript ya restringe el caller, pero un cast en runtime
  // (o un futuro caller dinámico) podría colar un kind fuera del union.
  // Descartamos silenciosamente para no contaminar la cache.
  if (!isRecentEntityKind(entity.kind)) {
    console.warn(`[recientes] descartando entry con kind no soportado: ${String(entity.kind)}`)
    return
  }
  const filtrados = cache.filter((e) => !(e.kind === entity.kind && e.id === entity.id))
  const nuevo: RecentEntity = { ...entity, visitedAt: new Date().toISOString() }
  const next = [nuevo, ...filtrados].slice(0, MAX_ENTRIES)
  escribir(next)
}

// Reset de la cache — solo para tests. Se exporta detrás de un getter para
// que no aparezca como API pública en autocomplete normal del IDE.
export function __resetRecentEntitiesForTests(): void {
  cache = []
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignorar
  }
  notify()
}

// Rehidrata la cache leyendo desde localStorage — solo para tests. Permite
// sembrar payloads (válidos o envenenados) en localStorage y verificar el
// comportamiento del parser sin tener que recargar el módulo.
export function __rehydrateRecentEntitiesForTests(): void {
  cache = leerStorage()
  notify()
}

// -- Hooks públicos ----------------------------------------------------------

function detectarRuta(pathname: string): { kind: RecentEntityKind; id: number } | null {
  for (const { pattern, kind } of ROUTE_TO_KIND) {
    const match = pathname.match(pattern)
    if (match) {
      const id = Number(match[1])
      // IDs en SQLite empiezan en 1 (AUTOINCREMENT). Un `/clientes/0` o
      // `/pedidos/-1` (ej. URL manualmente alterada) no debe ensuciar el
      // historial reciente — entidades con esos IDs no existen.
      if (!Number.isFinite(id) || id <= 0) return null
      return { kind, id }
    }
  }
  return null
}

// Devuelve la lista actual de recientes, suscribiéndose a cambios — todos
// los consumers (palette, atajos, debug) reciben el mismo snapshot.
export function useRecentEntities(): {
  recientes: RecentEntity[]
  agregar: (entity: Omit<RecentEntity, 'visitedAt'>) => void
  limpiar: () => void
} {
  const recientes = useSyncExternalStore(suscribir, snapshot, snapshot)
  const agregar = useCallback((entity: Omit<RecentEntity, 'visitedAt'>) => {
    agregarStore(entity)
  }, [])
  const limpiar = useCallback(() => {
    escribir([])
  }, [])
  return { recientes, agregar, limpiar }
}

// Se monta una sola vez en el AppShell. Detecta navegación a rutas detalle
// y registra un acceso reciente con un título placeholder. Las páginas
// detalle pueden refinar el título llamando `agregar()` con datos completos.
export function useTrackRouteAsRecent(): void {
  const location = useLocation()
  const { agregar } = useRecentEntities()
  const lastTrackedRef = useRef<string>('')

  useEffect(() => {
    const ruta = detectarRuta(location.pathname)
    if (!ruta) return
    // Evita re-tracking en re-renders del shell con la misma URL.
    const key = `${ruta.kind}:${ruta.id}`
    if (lastTrackedRef.current === key) return
    lastTrackedRef.current = key
    agregar({
      kind: ruta.kind,
      id: ruta.id,
      titulo: tituloPlaceholder(ruta.kind, ruta.id)
    })
  }, [location.pathname, agregar])
}

function tituloPlaceholder(kind: RecentEntityKind, id: number): string {
  switch (kind) {
    case 'cliente':
      return `Cliente #${id}`
    case 'pedido':
      return `Pedido #${id}`
    case 'factura':
      return `Factura #${id}`
    case 'contrato':
      return `Contrato #${id}`
  }
}
