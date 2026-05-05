// @vitest-environment jsdom
//
// Tests del helper de motion. Verifica el parseo de tokens CSS, los
// fallbacks cuando el browser no responde, y la cache lazy.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { __resetMotionCacheForTests, getMotionDurationMs } from './motion'

describe('getMotionDurationMs', () => {
  beforeEach(() => {
    __resetMotionCacheForTests()
  })
  afterEach(() => {
    document.documentElement.style.removeProperty('--duration-fast')
    document.documentElement.style.removeProperty('--duration-base')
    document.documentElement.style.removeProperty('--duration-instant')
    __resetMotionCacheForTests()
  })

  it('lee tokens en formato ms', () => {
    document.documentElement.style.setProperty('--duration-fast', '150ms')
    expect(getMotionDurationMs('fast')).toBe(150)
  })

  it('lee tokens en formato segundos y los convierte a ms', () => {
    document.documentElement.style.setProperty('--duration-base', '0.25s')
    expect(getMotionDurationMs('base')).toBe(250)
  })

  it('cae al fallback cuando el token no está definido', () => {
    document.documentElement.style.removeProperty('--duration-instant')
    const v = getMotionDurationMs('instant')
    expect(v).toBeGreaterThan(0)
  })

  it('devuelve fallback razonable para cada token de la escala', () => {
    const tokens = ['instant', 'fast', 'base', 'slow', 'slower'] as const
    const valores = tokens.map((t) => getMotionDurationMs(t))
    for (let i = 1; i < valores.length; i++) {
      expect(valores[i]!).toBeGreaterThan(valores[i - 1]!)
    }
  })

  it('cachea el valor real (sin re-leer del DOM en llamadas siguientes)', () => {
    document.documentElement.style.setProperty('--duration-fast', '150ms')
    expect(getMotionDurationMs('fast')).toBe(150)
    // Cambiamos el token — el valor cacheado se mantiene hasta reset.
    document.documentElement.style.setProperty('--duration-fast', '999ms')
    expect(getMotionDurationMs('fast')).toBe(150)
    // Tras reset, vuelve a leer el real.
    __resetMotionCacheForTests()
    expect(getMotionDurationMs('fast')).toBe(999)
  })

  it('NO cachea el fallback — re-intenta leer el DOM en próximas llamadas', () => {
    // Sin token definido al primer call → fallback (150).
    expect(getMotionDurationMs('fast')).toBe(150)
    // Más tarde el CSS expone el token real — la próxima llamada lo lee.
    document.documentElement.style.setProperty('--duration-fast', '300ms')
    expect(getMotionDurationMs('fast')).toBe(300)
  })

  it('robusto a tokens con whitespace y formatos raros', () => {
    document.documentElement.style.setProperty('--duration-fast', '  200ms  ')
    expect(getMotionDurationMs('fast')).toBe(200)
  })
})
