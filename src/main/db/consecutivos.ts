import { eq } from 'drizzle-orm'
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

export function generarConsecutivo(db: DB, tipo: TipoConsecutivo): string {
  return db.transaction((tx) => {
    const clave = CLAVES[tipo]
    let row = tx.select().from(configuracion).where(eq(configuracion.clave, clave)).get()
    if (!row) {
      // Auto-provisionamiento de contadores nuevos (p.ej. cuenta_cobro añadido
      // después del primer despliegue). Empezamos desde 1 para mantener la
      // numeración limpia.
      row = tx
        .insert(configuracion)
        .values({ clave, valor: '1', descripcion: DESCRIPCIONES[tipo] })
        .returning()
        .get()
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
