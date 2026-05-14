import { describe, expect, it } from 'vitest'
import { parseConfigNumber, validarValorConfig } from './configuracion'

describe('parseConfigNumber', () => {
  it('null/undefined → fallback', () => {
    expect(parseConfigNumber(null)).toBe(0)
    expect(parseConfigNumber(null, 100)).toBe(100)
  })

  it('parsea valores numéricos válidos', () => {
    expect(parseConfigNumber('42')).toBe(42)
    expect(parseConfigNumber('0')).toBe(0)
    expect(parseConfigNumber('3.14')).toBe(3.14)
    expect(parseConfigNumber('-5')).toBe(-5)
  })

  it('strings no numéricos → fallback', () => {
    expect(parseConfigNumber('abc')).toBe(0)
    expect(parseConfigNumber('', 50)).toBe(50)
    expect(parseConfigNumber('NaN', 100)).toBe(100)
  })

  it('Infinity y -Infinity → fallback (regresión: antes propagaba)', () => {
    // Si alguien hacía `setConfig("clave", "1e999")` por bypass o script,
    // parseFloat lo convertía a Infinity. Eso entraba a cálculos del
    // cotizador y mostraba "$Infinity" en la UI. Ahora retorna fallback.
    expect(parseConfigNumber('1e999')).toBe(0)
    expect(parseConfigNumber('-1e999', 50)).toBe(50)
    expect(parseConfigNumber('Infinity')).toBe(0)
    expect(parseConfigNumber('-Infinity')).toBe(0)
  })

  it('parseFloat extrae prefijo numérico (comportamiento JS)', () => {
    // parseFloat('42abc') = 42. Es comportamiento JS estándar; lo
    // documentamos por claridad. No es bug — los datos en DB siempre
    // pasan por setConfig que ya valida.
    expect(parseConfigNumber('42abc')).toBe(42)
    expect(parseConfigNumber('   8000   ')).toBe(8000)
  })
})

describe('validarValorConfig — SPEC_NUMERICAS exhaustiva', () => {
  describe('claves de días (entero 0-365)', () => {
    const claves = [
      'tiempo_entrega_default',
      'dias_entrega_urgente',
      'dias_entrega_estandar',
      'dias_entrega_sin_afan'
    ]

    for (const clave of claves) {
      describe(clave, () => {
        it('acepta 0 (mínimo)', () => {
          const r = validarValorConfig(clave, '0')
          expect(r.ok).toBe(true)
        })
        it('acepta 365 (máximo)', () => {
          const r = validarValorConfig(clave, '365')
          expect(r.ok).toBe(true)
        })
        it('acepta valor típico', () => {
          const r = validarValorConfig(clave, '7')
          expect(r.ok).toBe(true)
          if (r.ok) expect(r.valor).toBe(7)
        })
        it('rechaza negativo (PoC -2 del informe)', () => {
          const r = validarValorConfig(clave, '-2')
          expect(r.ok).toBe(false)
        })
        it('rechaza decimal (PoC 3.5 del informe)', () => {
          const r = validarValorConfig(clave, '3.5')
          expect(r.ok).toBe(false)
          if (!r.ok) expect(r.error).toMatch(/entero/i)
        })
        it('rechaza valor muy grande (PoC 100000000 del informe)', () => {
          const r = validarValorConfig(clave, '100000000')
          expect(r.ok).toBe(false)
        })
        it('rechaza no-número', () => {
          const r = validarValorConfig(clave, 'abc')
          expect(r.ok).toBe(false)
        })
        it('rechaza Infinity (parsea como Infinity, no finito)', () => {
          const r = validarValorConfig(clave, '1e999')
          expect(r.ok).toBe(false)
        })
      })
    }
  })

  describe('porcentaje_materiales_default (5-10)', () => {
    it('acepta 5 (mínimo)', () => {
      expect(validarValorConfig('porcentaje_materiales_default', '5').ok).toBe(true)
    })
    it('acepta 10 (máximo)', () => {
      expect(validarValorConfig('porcentaje_materiales_default', '10').ok).toBe(true)
    })
    it('rechaza 4 (debajo de Fase 2)', () => {
      expect(validarValorConfig('porcentaje_materiales_default', '4').ok).toBe(false)
    })
    it('rechaza 11', () => {
      expect(validarValorConfig('porcentaje_materiales_default', '11').ok).toBe(false)
    })
    it('rechaza negativo', () => {
      expect(validarValorConfig('porcentaje_materiales_default', '-1').ok).toBe(false)
    })
  })

  describe('margen_minimo_alerta_pct (0-100)', () => {
    it('acepta 0', () => {
      expect(validarValorConfig('margen_minimo_alerta_pct', '0').ok).toBe(true)
    })
    it('acepta 100', () => {
      expect(validarValorConfig('margen_minimo_alerta_pct', '100').ok).toBe(true)
    })
    it('rechaza -50 (regresión: cambiaría dirección de alertas)', () => {
      expect(validarValorConfig('margen_minimo_alerta_pct', '-50').ok).toBe(false)
    })
    it('rechaza 101', () => {
      expect(validarValorConfig('margen_minimo_alerta_pct', '101').ok).toBe(false)
    })
  })

  describe('porcentaje_costo_materiales_armado_default (0-100)', () => {
    it('acepta 45 (default)', () => {
      expect(validarValorConfig('porcentaje_costo_materiales_armado_default', '45').ok).toBe(true)
    })
    it('rechaza negativo', () => {
      expect(validarValorConfig('porcentaje_costo_materiales_armado_default', '-5').ok).toBe(false)
    })
    it('rechaza > 100', () => {
      expect(validarValorConfig('porcentaje_costo_materiales_armado_default', '150').ok).toBe(false)
    })
  })

  describe('precios (0-100M COP)', () => {
    it('acepta precio razonable', () => {
      expect(validarValorConfig('precio_clase_mensual', '110000').ok).toBe(true)
      expect(validarValorConfig('precio_kit_dibujo', '15000').ok).toBe(true)
    })
    it('rechaza precio absurdo (> 100M)', () => {
      expect(validarValorConfig('precio_clase_mensual', '999999999').ok).toBe(false)
    })
    it('rechaza negativo', () => {
      expect(validarValorConfig('precio_kit_dibujo', '-1000').ok).toBe(false)
    })
  })

  describe('consecutivos (enteros ≥1)', () => {
    it('rechaza 0 (no es válido para consecutivo, mínimo es 1)', () => {
      expect(validarValorConfig('consecutivo_facturas', '0').ok).toBe(false)
    })
    it('rechaza decimal', () => {
      expect(validarValorConfig('consecutivo_pedidos', '1.5').ok).toBe(false)
    })
    it('acepta 1', () => {
      expect(validarValorConfig('consecutivo_contratos', '1').ok).toBe(true)
    })
  })

  describe('claves NO numéricas (strings libres)', () => {
    it('acepta cualquier valor sin validar', () => {
      // Strings como nombre_negocio no están en SPEC_NUMERICAS, así que
      // pasan validarValorConfig sin chequeo. La sanitización de longitud
      // y caracteres ocurre en parseConfiguracion (truncado a 200 chars).
      expect(validarValorConfig('nombre_negocio', 'cualquier texto').ok).toBe(true)
      expect(validarValorConfig('rut', '79343820').ok).toBe(true)
      expect(validarValorConfig('correo', 'foo@bar.com').ok).toBe(true)
    })
  })
})
