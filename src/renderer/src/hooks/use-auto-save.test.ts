// @vitest-environment jsdom
//
// Tests del hardening de `loadAutoSaveDraft` (informe e2fe3c7 + auditoría
// asociada): el cast directo `as { data: T }` permitía que `null`/strings/
// objetos parciales llegaran a callers (wizard-shell, multi-trabajo) y
// crashearan en el primer deref. Ahora la función:
//   1. Valida que el JSON raíz sea objeto.
//   2. Si se pasa `validate`, lo aplica a `data` y descarta si retorna null.
//   3. Si NO se pasa validate, descarta `data` null/undefined explícitos.
//   4. Borra la clave en cualquier caso de descarte para que la próxima
//      visita no reintente con el mismo payload corrupto.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadAutoSaveDraft, loadAutoSaveDraftWithStatus } from './use-auto-save'

const KEY = 'test-key'
const STORAGE_KEY = `ca:autosave:${KEY}`

describe('loadAutoSaveDraft — hardening', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('devuelve null si la clave no existe', () => {
    expect(loadAutoSaveDraft(KEY)).toBeNull()
  })

  it('devuelve null y limpia si el JSON raíz no es objeto', () => {
    window.localStorage.setItem(STORAGE_KEY, '"foo"')
    expect(loadAutoSaveDraft(KEY)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('devuelve null y limpia si el JSON está malformado', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(loadAutoSaveDraft(KEY)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('devuelve null y limpia si data es null literal (PoC)', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: null, savedAt: '2026-05-06T10:00:00Z' })
    )
    expect(loadAutoSaveDraft(KEY)).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('devuelve null si data es undefined (clave faltante)', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ savedAt: '2026-05-06T10:00:00Z' })
    )
    expect(loadAutoSaveDraft(KEY)).toBeNull()
  })

  it('sin validate: pasa data tal cual si no es null/undefined', () => {
    const data = { foo: 'bar', n: 42 }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data, savedAt: '2026-05-06T10:00:00Z' })
    )
    const r = loadAutoSaveDraft<typeof data>(KEY)
    expect(r).not.toBeNull()
    expect(r!.data).toEqual(data)
  })

  it('con validate: descarta cuando validador retorna null', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: { malo: true }, savedAt: '2026-05-06T10:00:00Z' })
    )
    const r = loadAutoSaveDraft<{ malo: boolean }>(KEY, () => null)
    expect(r).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('con validate: descarta cuando validador retorna undefined', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: 'no-es-shape-esperado', savedAt: '2026-05-06T10:00:00Z' })
    )
    const r = loadAutoSaveDraft(KEY, () => undefined)
    expect(r).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('con validate: usa el valor que el validador retorna (puede sanear)', () => {
    type Shape = { x: number }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: { x: 99 }, savedAt: '2026-05-06T10:00:00Z' })
    )
    const r = loadAutoSaveDraft<Shape>(KEY, (raw) => {
      if (typeof raw === 'object' && raw !== null && 'x' in raw && typeof raw.x === 'number') {
        return raw as Shape
      }
      return null
    })
    expect(r).not.toBeNull()
    expect(r!.data).toEqual({ x: 99 })
  })

  it('parsea savedAt cuando es string ISO válido', () => {
    const iso = '2026-05-06T10:00:00.000Z'
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: { x: 1 }, savedAt: iso })
    )
    const r = loadAutoSaveDraft<{ x: number }>(KEY)
    expect(r).not.toBeNull()
    expect(r!.savedAt.toISOString()).toBe(iso)
  })

  it('cae a epoch (new Date(0)) si savedAt es de tipo no esperado', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: { x: 1 }, savedAt: { weird: true } })
    )
    const r = loadAutoSaveDraft<{ x: number }>(KEY)
    expect(r).not.toBeNull()
    expect(r!.savedAt.getTime()).toBe(0)
  })

  it('tras descarte por shape malformado, una segunda lectura es null sin tocar storage', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: null }))
    expect(loadAutoSaveDraft(KEY)).toBeNull()
    // Storage ya quedó limpio.
    expect(loadAutoSaveDraft(KEY)).toBeNull()
  })
})

describe('loadAutoSaveDraftWithStatus — detección de drafts descartados', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('sin draft persistido → draft=null, hadCorruptDraft=false', () => {
    const r = loadAutoSaveDraftWithStatus(KEY)
    expect(r.draft).toBeNull()
    expect(r.hadCorruptDraft).toBe(false)
  })

  it('draft válido → draft poblado, hadCorruptDraft=false', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: { foo: 'bar' }, savedAt: '2026-05-12T10:00:00Z' })
    )
    const r = loadAutoSaveDraftWithStatus<{ foo: string }>(KEY)
    expect(r.draft?.data.foo).toBe('bar')
    expect(r.hadCorruptDraft).toBe(false)
  })

  it('draft malformado (data null) → draft=null, hadCorruptDraft=true', () => {
    // El caller debería notificar al usuario que tenía un borrador pero
    // se descartó. Antes el comportamiento era silencioso y el usuario
    // veía un form vacío sin entender por qué.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: null }))
    const r = loadAutoSaveDraftWithStatus(KEY)
    expect(r.draft).toBeNull()
    expect(r.hadCorruptDraft).toBe(true)
    // Y la key ya está limpia para que no se quede acumulando.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('draft rechazado por validator → hadCorruptDraft=true', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: { foo: 'bar' }, savedAt: '2026-05-12T10:00:00Z' })
    )
    // Validator estricto que rechaza todo.
    const r = loadAutoSaveDraftWithStatus(KEY, () => null)
    expect(r.draft).toBeNull()
    expect(r.hadCorruptDraft).toBe(true)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('JSON malformado → hadCorruptDraft=true', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json')
    const r = loadAutoSaveDraftWithStatus(KEY)
    expect(r.draft).toBeNull()
    expect(r.hadCorruptDraft).toBe(true)
  })
})
