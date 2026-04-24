import { describe, expect, it } from 'vitest'
import {
  formatTelefonoInternacional,
  mensajeListoParaRecoger,
  mensajeRecordatorioCobro,
  mensajeRecordatorioEntrega,
  whatsappUrl
} from './whatsapp'

describe('formatTelefonoInternacional', () => {
  it('devuelve null para entradas vacías o nulas', () => {
    expect(formatTelefonoInternacional(null)).toBeNull()
    expect(formatTelefonoInternacional(undefined)).toBeNull()
    expect(formatTelefonoInternacional('')).toBeNull()
    expect(formatTelefonoInternacional('   ')).toBeNull()
  })

  it('devuelve null si tiene menos de 7 dígitos', () => {
    expect(formatTelefonoInternacional('12345')).toBeNull()
    expect(formatTelefonoInternacional('abc-def')).toBeNull()
  })

  it('prepende +57 a un móvil colombiano crudo de 10 dígitos', () => {
    expect(formatTelefonoInternacional('3104567890')).toBe('573104567890')
  })

  it('limpia caracteres no dígitos antes de prepender', () => {
    expect(formatTelefonoInternacional('310-456 7890')).toBe('573104567890')
    expect(formatTelefonoInternacional('(310) 456-7890')).toBe('573104567890')
  })

  it('respeta números que ya traen el código de país', () => {
    expect(formatTelefonoInternacional('573104567890')).toBe('573104567890')
    expect(formatTelefonoInternacional('+57 310 456 7890')).toBe('573104567890')
  })

  it('permite sobrescribir el país por parámetro', () => {
    expect(formatTelefonoInternacional('5551234567', '1')).toBe('15551234567')
  })
})

describe('mensajeRecordatorioCobro', () => {
  it('incluye primer nombre, número de pedido y saldo formateado', () => {
    const msg = mensajeRecordatorioCobro({
      nombreCliente: 'María López',
      pedidoNumero: 'P-0042',
      saldo: 85000
    })
    expect(msg).toMatch(/Hola María/)
    expect(msg).toMatch(/P-0042/)
    expect(msg).toMatch(/\$\s*85/)
    expect(msg).toMatch(/Casa Alberto/)
    expect(msg).toMatch(/Gracias/)
  })

  it('usa solo el primer nombre cuando el cliente tiene varios', () => {
    const msg = mensajeRecordatorioCobro({
      nombreCliente: 'Juan Carlos Pérez',
      pedidoNumero: 'P-0001',
      saldo: 10000
    })
    expect(msg).toMatch(/Hola Juan,/)
    expect(msg).not.toMatch(/Juan Carlos/)
  })

  it('se mantiene debajo del límite de 280 caracteres', () => {
    const msg = mensajeRecordatorioCobro({
      nombreCliente: 'Cliente con nombre muy largo compuesto de varias palabras',
      pedidoNumero: 'P-9999',
      saldo: 99999999
    })
    expect(msg.length).toBeLessThanOrEqual(280)
  })
})

describe('mensajeRecordatorioEntrega', () => {
  it('incluye primer nombre y número de pedido en tono amable cuando no está atrasada', () => {
    const msg = mensajeRecordatorioEntrega({
      nombreCliente: 'María López',
      pedidoNumero: 'P-0042',
      atrasada: false
    })
    expect(msg).toMatch(/Hola María/)
    expect(msg).toMatch(/P-0042/)
    expect(msg).toMatch(/Casa Alberto/)
    expect(msg).toMatch(/programado/)
    expect(msg).toMatch(/Gracias/)
  })

  it('cambia el tono cuando la entrega está atrasada (pide que pase a recoger)', () => {
    const msg = mensajeRecordatorioEntrega({
      nombreCliente: 'Juan',
      pedidoNumero: 'P-0010',
      atrasada: true
    })
    expect(msg).toMatch(/pendiente de entrega/)
    expect(msg).toMatch(/recogerlo/)
    expect(msg).not.toMatch(/programado/)
  })

  it('se mantiene debajo del límite de 280 caracteres', () => {
    const msg = mensajeRecordatorioEntrega({
      nombreCliente: 'Cliente con nombre muy largo compuesto',
      pedidoNumero: 'P-9999',
      atrasada: true
    })
    expect(msg.length).toBeLessThanOrEqual(280)
  })
})

describe('mensajeListoParaRecoger', () => {
  it('incluye primer nombre, número de pedido y tono cercano', () => {
    const msg = mensajeListoParaRecoger({
      nombreCliente: 'María López',
      pedidoNumero: 'P-0042'
    })
    expect(msg).toMatch(/Hola María/)
    expect(msg).toMatch(/P-0042/)
    expect(msg).toMatch(/Casa Alberto/)
    expect(msg).toMatch(/listo para recoger/)
    expect(msg).toMatch(/Gracias/)
  })

  it('usa solo el primer nombre cuando el cliente tiene varios', () => {
    const msg = mensajeListoParaRecoger({
      nombreCliente: 'Juan Carlos Pérez',
      pedidoNumero: 'P-0001'
    })
    expect(msg).toMatch(/Hola Juan,/)
    expect(msg).not.toMatch(/Juan Carlos/)
  })

  it('se mantiene debajo del límite de 280 caracteres', () => {
    const msg = mensajeListoParaRecoger({
      nombreCliente: 'Cliente con nombre compuesto muy largo de varias palabras',
      pedidoNumero: 'P-9999'
    })
    expect(msg.length).toBeLessThanOrEqual(280)
  })
})

describe('whatsappUrl', () => {
  it('arma URL wa.me correcta con mensaje codificado', () => {
    const url = whatsappUrl('3104567890', 'Hola mundo')
    expect(url).toBe('https://wa.me/573104567890?text=Hola%20mundo')
  })

  it('codifica caracteres especiales (acentos, emojis, signos)', () => {
    const url = whatsappUrl('3104567890', '¿Cómo estás?')
    // expect que encodeURIComponent haya hecho su trabajo
    expect(url).toContain('%C2%BF') // ¿
    expect(url).toContain('%C3%B3') // ó
    expect(url).not.toContain('¿')
  })

  it('retorna null si el teléfono es inválido', () => {
    expect(whatsappUrl(null, 'x')).toBeNull()
    expect(whatsappUrl('', 'x')).toBeNull()
    expect(whatsappUrl('12', 'x')).toBeNull()
  })
})
