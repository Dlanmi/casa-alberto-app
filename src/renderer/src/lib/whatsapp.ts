// Helpers para generar URLs de WhatsApp (wa.me) con mensaje pre-escrito.
// Usados por el HelpButton (tip de deudores accionables): papá ve al
// cliente que debe, hace click en el botón WhatsApp y se abre la app/web
// con el mensaje ya listo para enviar.
//
// Colombia es el país por defecto (+57). Si el número ya viene con
// prefijo internacional, se respeta.

import { formatCOP } from './format'

const DEFAULT_PAIS = '57'
const MAX_LEN_MENSAJE = 280 // margen cómodo para no truncar en URL

/**
 * Normaliza un teléfono a formato internacional apto para wa.me.
 * - Acepta formatos "crudos" típicos del repo: `'3104567890'` → `'573104567890'`.
 * - Si el usuario incluyó el código de país (`'+573104567890'` o
 *   `'573104567890'`), lo respeta (solo limpia espacios/guiones/paréntesis).
 * - Retorna null para strings vacíos, null, undefined, o con menos de 7 dígitos.
 */
export function formatTelefonoInternacional(
  tel: string | null | undefined,
  pais: string = DEFAULT_PAIS
): string | null {
  if (!tel) return null
  const limpio = tel.replace(/\D/g, '')
  if (limpio.length < 7) return null
  // Si ya empieza con el código de país (ej. "57..."), no lo duplicamos.
  // Heurística: si la longitud total es > 10 y comienza con el código de país,
  // se asume que ya trae el prefijo.
  if (limpio.startsWith(pais) && limpio.length > 10) return limpio
  // Caso normal: número local colombiano (10 dígitos). Le prepend del país.
  return `${pais}${limpio}`
}

/**
 * Arma el mensaje pre-escrito que papá va a mandar por WhatsApp a un
 * deudor. Tono cercano y amigable (confirmado por el usuario). Se mantiene
 * debajo del límite para evitar truncamiento al codificar en la URL.
 */
export function mensajeRecordatorioCobro(args: {
  nombreCliente: string
  pedidoNumero: string
  saldo: number
}): string {
  const nombre = args.nombreCliente.trim().split(' ')[0] || 'hola'
  const saldoTxt = formatCOP(args.saldo)
  const msg =
    `Hola ${nombre}, te saluda Casa Alberto. ` +
    `Quería recordarte tu pedido ${args.pedidoNumero} por ${saldoTxt}. ` +
    `¿Cuándo podrías pasar a completar el pago? Gracias.`
  return msg.length > MAX_LEN_MENSAJE ? msg.slice(0, MAX_LEN_MENSAJE - 1) + '…' : msg
}

/**
 * Mensaje para recordar al cliente la entrega programada. Se adapta según
 * si el pedido está atrasado (pide que pase a recoger) o en su ventana
 * normal (aviso amable). Usado por el popup de agenda.
 */
export function mensajeRecordatorioEntrega(args: {
  nombreCliente: string
  pedidoNumero: string
  atrasada: boolean
}): string {
  const nombre = args.nombreCliente.trim().split(' ')[0] || 'hola'
  const msg = args.atrasada
    ? `Hola ${nombre}, te saluda Casa Alberto. Quería avisarte que tu pedido ${args.pedidoNumero} ya está pendiente de entrega. ¿Cuándo podrías pasar a recogerlo? Gracias.`
    : `Hola ${nombre}, te saluda Casa Alberto. Te recuerdo que tu pedido ${args.pedidoNumero} está programado para entrega. Cualquier cosa me escribes. Gracias.`
  return msg.length > MAX_LEN_MENSAJE ? msg.slice(0, MAX_LEN_MENSAJE - 1) + '…' : msg
}

/**
 * Mensaje para avisar al cliente que el pedido ya está terminado y puede
 * pasar a recogerlo. Usado cuando el estado del pedido es `listo`; difiere
 * de `mensajeRecordatorioEntrega` en que no habla de "programado" sino de
 * "listo" — tono cercano, invita a pasar cuando le quede bien.
 */
export function mensajeListoParaRecoger(args: {
  nombreCliente: string
  pedidoNumero: string
}): string {
  const nombre = args.nombreCliente.trim().split(' ')[0] || 'hola'
  const msg =
    `Hola ${nombre}, te saluda Casa Alberto. ` +
    `Tu pedido ${args.pedidoNumero} ya está listo para recoger. ` +
    `¿Cuándo te queda bien pasar? Gracias.`
  return msg.length > MAX_LEN_MENSAJE ? msg.slice(0, MAX_LEN_MENSAJE - 1) + '…' : msg
}

/**
 * Construye la URL https://wa.me/{tel}?text=... con el mensaje codificado.
 * Retorna null si el teléfono no es válido — el caller decide si mostrar
 * el botón o no.
 */
export function whatsappUrl(
  tel: string | null | undefined,
  mensaje: string,
  pais: string = DEFAULT_PAIS
): string | null {
  const numero = formatTelefonoInternacional(tel, pais)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}
