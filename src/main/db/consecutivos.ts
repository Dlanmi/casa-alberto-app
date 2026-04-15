import { eq } from 'drizzle-orm'
import type { DB } from './index'
import { configuracion } from './schema'

type TipoConsecutivo = 'pedido' | 'factura' | 'contrato'

const PREFIJOS: Record<TipoConsecutivo, string> = {
  pedido: 'P',
  factura: 'F',
  contrato: 'C'
}

const CLAVES: Record<TipoConsecutivo, string> = {
  pedido: 'consecutivo_pedidos',
  factura: 'consecutivo_facturas',
  contrato: 'consecutivo_contratos'
}

export function generarConsecutivo(db: DB, tipo: TipoConsecutivo): string {
  return db.transaction((tx) => {
    const clave = CLAVES[tipo]
    const row = tx.select().from(configuracion).where(eq(configuracion.clave, clave)).get()
    if (!row) {
      throw new Error(`Consecutivo '${clave}' no encontrado en configuracion`)
    }
    const n = parseInt(row.valor, 10)
    if (Number.isNaN(n)) {
      throw new Error(`Consecutivo '${clave}' tiene valor inválido: ${row.valor}`)
    }
    tx.update(configuracion)
      .set({ valor: String(n + 1) })
      .where(eq(configuracion.clave, clave))
      .run()
    return `${PREFIJOS[tipo]}-${String(n).padStart(4, '0')}`
  })
}
