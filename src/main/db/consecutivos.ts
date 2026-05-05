import { eq, sql } from 'drizzle-orm'
import type { DB } from './index'
import { configuracion } from './schema'

type TipoConsecutivo = 'pedido' | 'factura' | 'contrato' | 'cuenta_cobro'

const PREFIJOS: Record<TipoConsecutivo, string> = {
  pedido: 'P',
  factura: 'F',
  contrato: 'C',
  cuenta_cobro: 'CC'
}

const CLAVES: Record<TipoConsecutivo, string> = {
  pedido: 'consecutivo_pedidos',
  factura: 'consecutivo_facturas',
  contrato: 'consecutivo_contratos',
  cuenta_cobro: 'consecutivo_cuentas_cobro'
}

const DESCRIPCIONES: Record<TipoConsecutivo, string> = {
  pedido: 'Siguiente número de pedido',
  factura: 'Siguiente número de factura',
  contrato: 'Siguiente número de contrato',
  cuenta_cobro: 'Siguiente número de cuenta de cobro'
}

/**
 * Devuelve el siguiente número formateado para el tipo dado y avanza el
 * contador en `configuracion`. Atomicidad:
 *
 *   - Si se llama fuera de una transacción, abre una propia (top-level).
 *   - Si se llama DENTRO de otra transacción (caller pasó `txDb`),
 *     better-sqlite3 lo convierte en SAVEPOINT automáticamente. El
 *     contador queda consistente con el outer commit/rollback — si el
 *     caller hace throw después de obtener el número, el contador NO se
 *     gasta.
 *
 * Esto último importa para `crearPedidoDirecto`: si la inserción del pedido
 * o sus items falla después de `generarConsecutivo`, el rollback del
 * outer revierte también el incremento. No hay huecos en numeración.
 */
export function generarConsecutivo(db: DB, tipo: TipoConsecutivo): string {
  return db.transaction((tx) => {
    const clave = CLAVES[tipo]

    // Auto-provisionamiento idempotente. Si la clave ya existe, no hace nada.
    // Si no existe (p. ej. cuenta_cobro añadido después del primer despliegue),
    // la crea arrancando en 1.
    tx.insert(configuracion)
      .values({ clave, valor: '1', descripcion: DESCRIPCIONES[tipo] })
      .onConflictDoNothing()
      .run()

    // Incremento atómico a nivel SQL: leemos y escribimos el contador en la
    // misma sentencia. El valor retornado es el NUEVO (post-incremento), así
    // que el número emitido para este llamado es `nuevo - 1`.
    //
    // Evita la ventana entre select y update del código anterior, que en un
    // mundo con dos ventanas o dos procesos podría generar duplicados.
    const updated = tx
      .update(configuracion)
      .set({ valor: sql`CAST(CAST(${configuracion.valor} AS INTEGER) + 1 AS TEXT)` })
      .where(eq(configuracion.clave, clave))
      .returning({ valor: configuracion.valor })
      .get()

    if (!updated) {
      throw new Error(`No se pudo incrementar el consecutivo '${clave}'`)
    }
    const siguiente = parseInt(updated.valor, 10)
    if (Number.isNaN(siguiente) || siguiente < 2) {
      throw new Error(`Consecutivo '${clave}' tiene valor inválido: ${updated.valor}`)
    }
    const emitido = siguiente - 1
    return `${PREFIJOS[tipo]}-${String(emitido).padStart(4, '0')}`
  })
}
