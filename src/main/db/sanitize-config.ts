// Sanitización de valores de configuración al boot.
//
// Contexto inicial (v2.3.1): el informe de seguridad sobre commit `7f37f5b`
// mostró que el path de importación de Excel escribía valores DIRECTO a la
// tabla `configuracion` sin pasar por `setConfig` ni validar dominio.
// Resultado: un Excel malformado podía persistir `dias_entrega_urgente=-2`,
// `porcentaje_materiales_default=3.5`, etc. Esta función detecta esos
// valores al boot y los restaura al default del `CONFIG_INICIAL` del seed.
//
// Corrección (v2.3.2): el informe sobre `dae03af` mostró que aplicar la
// estrategia "restaurar al seed default" a los CONTADORES de documentos
// (`consecutivo_*`) era peligroso. El seed siembra todos los consecutivos
// en `1`; si la DB ya tiene F-0001/P-0001/etc., resetear el contador a 1
// hace que `generarConsecutivo` re-emita F-0001 → colisión con la columna
// `numero` UNIQUE → INSERT falla → rollback → DoS persistente para crear
// ese tipo de documento.
//
// Solución: los consecutivos tienen tratamiento separado de los settings:
//   - Settings (días, porcentajes, precios): restaurar al seed default.
//     El seed es un valor razonable y no hay riesgo de colisión.
//   - Consecutivos: computar el valor SEGURO desde las filas existentes
//     (`max(sufijo numérico de los `numero` actuales) + 1`). La numeración
//     de documentos NUNCA retrocede ni reutiliza números (requisito
//     contable), así que el contador se sube a ese valor seguro sólo si
//     está por debajo — nunca se baja.
//
// Idempotente: si todo está limpio, no toca nada. Si encuentra corrupción,
// lo arregla y loguea cada clave para auditoría.
import { eq } from 'drizzle-orm'
import type { DB } from '../db'
import { configuracion, contratos, cuentasCobro, facturas, pedidos } from './schema'
import { CONFIG_INICIAL } from './seed'
import { SPEC_NUMERICAS, validarValorConfig } from './queries/configuracion'

export type SanitizeReport = {
  /** Claves que tenían valor corrupto/inseguro y fueron corregidas. */
  sanitizadas: Array<{
    clave: string
    valorAnterior: string
    valorRestaurado: string
    razon: string
    /** `setting` = restaurado al default del seed.
     *  `consecutivo` = computado desde las filas de documentos. */
    tipo: 'setting' | 'consecutivo'
  }>
}

// Extrae el sufijo numérico de un `numero` de documento. El formato es
// `<PREFIJO>-<NNNN>` (P-0001, F-0042, CC-0003). El regex toma sólo el
// bloque de dígitos final — tolerante a numeros legacy con otro formato:
// si no matchea, esa fila simplemente no aporta al máximo.
const SUFIJO_NUMERO = /-(\d+)$/

/**
 * Calcula el siguiente valor SEGURO para un contador de documentos: el
 * máximo sufijo numérico presente en los `numero` dados, + 1. Si no hay
 * documentos (lista vacía o ninguno matchea el formato), retorna 1 — no
 * hay colisión posible con una tabla vacía.
 *
 * Función pura (recibe la lista de numeros, no la DB) para poder testearla
 * aislada.
 */
export function calcularConsecutivoSeguro(numeros: ReadonlyArray<string | null>): number {
  let maxSufijo = 0
  for (const numero of numeros) {
    const m = SUFIJO_NUMERO.exec(numero ?? '')
    if (!m) continue
    const n = parseInt(m[1], 10)
    if (Number.isFinite(n) && n > maxSufijo) maxSufijo = n
  }
  return maxSufijo + 1
}

// Mapa de cada clave consecutivo → función que lee los `numero` de su
// tabla. Cada lambda usa su tabla concreta (evita problemas de tipado con
// la unión de las 4 tablas en un `.from()` genérico). Si en el futuro se
// agrega un tipo de documento numerado, sumar acá su entrada.
const CONSECUTIVO_NUMEROS: Record<string, (db: DB) => Array<string | null>> = {
  consecutivo_pedidos: (db) => db.select({ numero: pedidos.numero }).from(pedidos).all().map((r) => r.numero),
  consecutivo_facturas: (db) =>
    db.select({ numero: facturas.numero }).from(facturas).all().map((r) => r.numero),
  consecutivo_contratos: (db) =>
    db.select({ numero: contratos.numero }).from(contratos).all().map((r) => r.numero),
  consecutivo_cuentas_cobro: (db) =>
    db.select({ numero: cuentasCobro.numero }).from(cuentasCobro).all().map((r) => r.numero)
}

/**
 * Itera todas las claves numéricas presentes en la DB y corrige las que
 * tienen valor inválido o inseguro:
 *   - Settings: restaura al default del seed (CONFIG_INICIAL).
 *   - Consecutivos: sube al siguiente valor seguro según las filas de
 *     documentos existentes (nunca baja el contador).
 *
 * Idempotente: segunda corrida sobre DB ya sana retorna `sanitizadas=[]`.
 */
export function sanitizeConfigOnBoot(db: DB): SanitizeReport {
  const report: SanitizeReport = { sanitizadas: [] }
  const defaultsPorClave = new Map(CONFIG_INICIAL.map((c) => [c.clave, c]))

  // Solo iteramos las claves que tienen spec numérica. Strings libres
  // como `nombre_negocio` no requieren sanitización numérica.
  for (const clave of Object.keys(SPEC_NUMERICAS)) {
    const row = db.select().from(configuracion).where(eq(configuracion.clave, clave)).get()
    if (!row) continue // clave no existe en DB, nada que sanitizar

    const obtenerNumeros = CONSECUTIVO_NUMEROS[clave]
    if (obtenerNumeros) {
      // ---- CONSECUTIVO: computar valor seguro desde las tablas ----
      // NO restauramos al seed (1) — eso re-emitiría F-0001/P-0001/etc.
      // y colisionaría con la columna `numero` UNIQUE (bug del informe
      // sobre dae03af). El valor correcto es max(sufijo existente) + 1.
      const seguro = calcularConsecutivoSeguro(obtenerNumeros(db))
      const validacion = validarValorConfig(clave, row.valor)
      const actual = parseFloat(row.valor)
      const actualUsable = validacion.ok // implica finito + entero + en rango

      // Sanitizar si el contador no es usable, O si está por debajo del
      // siguiente seguro (generaría números duplicados). NUNCA bajamos un
      // contador que ya es válido y suficientemente alto — la numeración
      // de documentos no retrocede aunque se hayan borrado filas.
      if (!actualUsable || actual < seguro) {
        const valorNuevo = String(seguro)
        db.update(configuracion)
          .set({ valor: valorNuevo })
          .where(eq(configuracion.clave, clave))
          .run()
        report.sanitizadas.push({
          clave,
          valorAnterior: row.valor,
          valorRestaurado: valorNuevo,
          razon: actualUsable
            ? `Contador (${row.valor}) por debajo del siguiente seguro (${seguro}); habría generado números de documento duplicados`
            : `Contador inválido (${validacion.ok ? row.valor : validacion.error}); recalculado desde los documentos existentes`,
          tipo: 'consecutivo'
        })
      }
      continue
    }

    // ---- SETTING normal: restaurar al default del seed ----
    const resultado = validarValorConfig(clave, row.valor)
    if (resultado.ok) continue // valor válido, dejarlo

    const seed = defaultsPorClave.get(clave)
    if (!seed) {
      // Clave en spec pero sin default conocido. Log y dejarla — no
      // hacemos guess. Solo pasa si alguien agregó la clave a
      // SPEC_NUMERICAS pero no a CONFIG_INICIAL (inconsistencia de
      // código que un code review notaría).
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
      razon: resultado.error,
      tipo: 'setting'
    })
  }

  if (report.sanitizadas.length > 0) {
    console.warn(
      `[sanitize-config] Corregidas ${report.sanitizadas.length} claves de configuración:`,
      report.sanitizadas
    )
  }
  return report
}
