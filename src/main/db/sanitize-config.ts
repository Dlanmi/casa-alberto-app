// Sanitización de valores de configuración al boot.
//
// Contexto: el informe de seguridad sobre commit `7f37f5b` mostró que el
// path de importación de Excel (parseConfiguracion + cargarPlantilla)
// escribía valores DIRECTO a la tabla `configuracion` sin pasar por
// `setConfig` ni validar dominio. Resultado: un Excel malformado podía
// persistir `dias_entrega_urgente=-2`, `porcentaje_materiales_default=3.5`,
// o `precio_clase_mensual=100000000` en la DB.
//
// El fix completo de v2.3.1 cierra el bypass en 3 capas (parser valida,
// loader usa setConfig, renderer clampea), pero deja abierto el caso
// transicional: usuarios que ya importaron Excel malformado ANTES del
// fix tienen valores corruptos persistidos.
//
// Esta función detecta esos valores al boot y los restaura al default
// del `CONFIG_INICIAL` del seed. Es idempotente: si todo está limpio,
// no toca nada. Si encuentra corrupción, lo arregla y loguea para
// auditoría.
import { eq } from 'drizzle-orm'
import type { DB } from '../db'
import { configuracion } from './schema'
import { CONFIG_INICIAL } from './seed'
import { SPEC_NUMERICAS, validarValorConfig } from './queries/configuracion'

export type SanitizeReport = {
  /** Claves que tenían valor corrupto y fueron restauradas. */
  sanitizadas: Array<{ clave: string; valorAnterior: string; valorRestaurado: string; razon: string }>
}

/**
 * Itera todas las claves numéricas presentes en la DB y restaura las que
 * tienen valor fuera de SPEC_NUMERICAS al default del seed. Solo toca
 * claves que SÍ tienen entry en CONFIG_INICIAL (las que no, las deja
 * como están — pueden ser flags internos sin default).
 *
 * Idempotente: segunda corrida sobre DB limpia retorna `sanitizadas=[]`.
 */
export function sanitizeConfigOnBoot(db: DB): SanitizeReport {
  const report: SanitizeReport = { sanitizadas: [] }
  const defaultsPorClave = new Map(CONFIG_INICIAL.map((c) => [c.clave, c]))

  // Solo iteramos las claves que tienen spec numérica. Strings libres
  // como `nombre_negocio` no requieren sanitización porque pasan trunc()
  // en el parser de Excel y `setConfig` no las valida.
  for (const clave of Object.keys(SPEC_NUMERICAS)) {
    const row = db.select().from(configuracion).where(eq(configuracion.clave, clave)).get()
    if (!row) continue // clave no existe en DB, nada que sanitizar
    const resultado = validarValorConfig(clave, row.valor)
    if (resultado.ok) continue // valor válido, dejarlo
    // Valor corrupto. Buscar default en CONFIG_INICIAL.
    const seed = defaultsPorClave.get(clave)
    if (!seed) {
      // Clave en spec pero sin default conocido. Log y dejarla — no
      // hacemos guess sobre qué valor poner. Esto solo pasa si alguien
      // agregó la clave a SPEC_NUMERICAS pero no a CONFIG_INICIAL
      // (inconsistencia de código que se notaría en code review).
      console.warn(
        `[sanitize-config] "${clave}" tiene valor corrupto "${row.valor}" pero no hay default en seed. Dejando como está.`
      )
      continue
    }
    db.update(configuracion)
      .set({ valor: seed.valor })
      .where(eq(configuracion.clave, clave))
      .run()
    report.sanitizadas.push({
      clave,
      valorAnterior: row.valor,
      valorRestaurado: seed.valor,
      razon: resultado.error
    })
  }

  if (report.sanitizadas.length > 0) {
    console.warn(
      `[sanitize-config] Restauradas ${report.sanitizadas.length} claves corruptas:`,
      report.sanitizadas
    )
  }
  return report
}
