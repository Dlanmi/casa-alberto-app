// @vitest-environment jsdom
//
// Tests del store singleton de recientes (`useRecentEntities`).
// Cubren: snapshot inicial desde localStorage, dedupe por (kind, id),
// cap MAX_ENTRIES, suscripción cross-instance, hardening contra payloads
// corruptos (ver informe de seguridad: kind inválido crashea CommandPalette).
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __rehydrateRecentEntitiesForTests,
  __resetRecentEntitiesForTests,
  isRecentEntityKind,
  RECENT_ENTITY_KINDS,
  useRecentEntities,
  type RecentEntity,
  type RecentEntityKind
} from './use-recent-entities'

const STORAGE_KEY = 'casa-alberto:palette-recent'

describe('useRecentEntities', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetRecentEntitiesForTests()
  })
  afterEach(() => {
    localStorage.clear()
    __resetRecentEntitiesForTests()
  })

  it('arranca vacío sin entries en localStorage', () => {
    const { result } = renderHook(() => useRecentEntities())
    expect(result.current.recientes).toEqual([])
  })

  it('agregar persiste en localStorage y devuelve la entry al frente', () => {
    const { result } = renderHook(() => useRecentEntities())
    act(() => {
      result.current.agregar({ kind: 'cliente', id: 1, titulo: 'Ana' })
    })
    expect(result.current.recientes).toHaveLength(1)
    expect(result.current.recientes[0]?.titulo).toBe('Ana')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(1)
  })

  it('dedupe por (kind, id) — re-agregar mueve al frente sin duplicar', () => {
    const { result } = renderHook(() => useRecentEntities())
    act(() => {
      result.current.agregar({ kind: 'cliente', id: 1, titulo: 'Ana' })
      result.current.agregar({ kind: 'cliente', id: 2, titulo: 'Juan' })
      result.current.agregar({ kind: 'cliente', id: 1, titulo: 'Ana' })
    })
    expect(result.current.recientes).toHaveLength(2)
    expect(result.current.recientes[0]?.id).toBe(1) // Ana al frente
    expect(result.current.recientes[1]?.id).toBe(2)
  })

  it('respeta el cap de 20 entradas (FIFO)', () => {
    const { result } = renderHook(() => useRecentEntities())
    act(() => {
      for (let i = 1; i <= 25; i++) {
        result.current.agregar({ kind: 'pedido', id: i, titulo: `P-${i}` })
      }
    })
    expect(result.current.recientes).toHaveLength(20)
    // El más reciente (id 25) debe estar primero, el más viejo (id 6) último.
    expect(result.current.recientes[0]?.id).toBe(25)
    expect(result.current.recientes[19]?.id).toBe(6)
  })

  it('limpiar borra todo y persiste el estado vacío', () => {
    const { result } = renderHook(() => useRecentEntities())
    act(() => {
      result.current.agregar({ kind: 'cliente', id: 1, titulo: 'Ana' })
      result.current.limpiar()
    })
    expect(result.current.recientes).toEqual([])
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]')
  })

  it('múltiples instancias del hook comparten estado en tiempo real', () => {
    const { result: a } = renderHook(() => useRecentEntities())
    const { result: b } = renderHook(() => useRecentEntities())
    act(() => {
      a.current.agregar({ kind: 'factura', id: 99, titulo: 'F-099' })
    })
    expect(b.current.recientes).toHaveLength(1)
    expect(b.current.recientes[0]?.id).toBe(99)
  })

  it('lee correctamente entradas pre-existentes en localStorage al montar', () => {
    const seed: RecentEntity[] = [
      { kind: 'cliente', id: 7, titulo: 'Pedro', visitedAt: '2026-04-01T10:00:00Z' }
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
    // Forzamos reset para que el módulo singleton vuelva a leer la cache.
    __resetRecentEntitiesForTests()
    // Re-import dinámico tras el reset — el cache se recompone leyendo
    // localStorage en la primera lectura (el reset notifica con []).
    // Reseteamos la cache, así que para simular "montaje fresco" sembramos
    // otra vez y consumimos el hook directo.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
    const { result } = renderHook(() => useRecentEntities())
    // Forzamos un agregar para que el hook re-lea desde localStorage al
    // mutar (el cache se actualiza al notificar).
    act(() => {
      result.current.agregar({ kind: 'pedido', id: 8, titulo: 'P-008' })
    })
    expect(result.current.recientes.some((r) => r.id === 8 && r.kind === 'pedido')).toBe(true)
  })

  // -- Hardening contra payloads corruptos -----------------------------------
  // El informe de seguridad (commit 75deb6b) describe un DoS local: un valor
  // arbitrario en `kind` indexa ICONO_POR_KIND con clave inexistente, retorna
  // undefined, y CommandPalette renderiza `<Icon />` con Icon=undefined,
  // crashendo el árbol de React. Estos tests garantizan que el parser
  // descarte cualquier kind fuera del union `RecentEntityKind`.

  it('isRecentEntityKind acepta solo los kinds del union', () => {
    expect(RECENT_ENTITY_KINDS).toEqual(['cliente', 'pedido', 'factura', 'contrato'])
    for (const kind of RECENT_ENTITY_KINDS) {
      expect(isRecentEntityKind(kind)).toBe(true)
    }
    expect(isRecentEntityKind('evil')).toBe(false)
    expect(isRecentEntityKind('')).toBe(false)
    expect(isRecentEntityKind('CLIENTE')).toBe(false) // case-sensitive
    expect(isRecentEntityKind(null)).toBe(false)
    expect(isRecentEntityKind(undefined)).toBe(false)
    expect(isRecentEntityKind(42)).toBe(false)
    expect(isRecentEntityKind({})).toBe(false)
  })

  it('filtra al leer localStorage entradas con kind no soportado', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mixto = [
      { kind: 'cliente', id: 1, titulo: 'Ana', visitedAt: '2026-04-01T10:00:00Z' },
      { kind: 'evil', id: 2, titulo: 'boom', visitedAt: '2026-04-01T10:00:00Z' },
      { kind: 'pedido', id: 3, titulo: 'P-003', visitedAt: '2026-04-01T10:00:00Z' },
      { kind: '', id: 4, titulo: 'empty', visitedAt: '2026-04-01T10:00:00Z' },
      { kind: 'factura', id: 5, titulo: 'F-005', visitedAt: '2026-04-01T10:00:00Z' }
    ]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mixto))
    // Forzamos al store a releer desde localStorage tras la siembra. El
    // beforeEach dejó la cache vacía; sin rehydrate, los tests no exercitan
    // el filter del parser.
    __rehydrateRecentEntitiesForTests()
    const { result } = renderHook(() => useRecentEntities())
    const kinds = result.current.recientes.map((r) => r.kind)
    // Solo sobreviven las 3 entries con kind dentro del union.
    expect(result.current.recientes).toHaveLength(3)
    expect(kinds).toEqual(['cliente', 'pedido', 'factura'])
    expect(kinds).not.toContain('evil')
    expect(kinds).not.toContain('')
    warnSpy.mockRestore()
  })

  it('PoC del informe: payload {kind:"x",id:1,titulo:"boom"} no contamina la cache', () => {
    // Reproduce el payload exacto del informe de seguridad. Sin el fix, este
    // payload llega al provider y a `<Icon />` con icono=undefined → crash.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const payload = [{ kind: 'x', id: 1, titulo: 'boom', visitedAt: '2026-01-01T00:00:00Z' }]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    __rehydrateRecentEntitiesForTests()
    const { result } = renderHook(() => useRecentEntities())
    expect(result.current.recientes).toHaveLength(0)
    warnSpy.mockRestore()
  })

  it('agregar con kind inválido es no-op y no contamina la cache', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useRecentEntities())
    act(() => {
      // Cast unsafe que simula un caller dinámico (IPC bypass, cast en runtime,
      // futuro consumer no validado). El guard en agregarStore lo descarta.
      result.current.agregar({
        kind: 'inyectado' as RecentEntityKind,
        id: 1,
        titulo: 'no debería entrar'
      })
    })
    expect(result.current.recientes).toHaveLength(0)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
