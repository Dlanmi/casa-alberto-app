// Conteos agregados por módulo. Usado por el HelpButton para detectar
// empty-states y mostrar tips tipo "Aún no tienes X, empieza aquí" cuando
// la pantalla está vacía. Una sola query IPC en vez de N para que abrir
// el popover no dispare muchas round-trips.
import { sql } from 'drizzle-orm'
import type { DB } from '../index'
import type { StatsGenerales } from '@shared/types'
import {
  clases,
  clientes,
  contratos,
  estudiantes,
  facturas,
  inventario,
  pedidos,
  proveedores
} from '../schema'

export type { StatsGenerales }

// Cada conteo es SELECT count(*); Drizzle requiere alias .as() para que el
// tipo de retorno sea usable. Usamos el mismo alias 'n' en todos.
export function statsGenerales(db: DB): StatsGenerales {
  const rClientes = db
    .select({ n: sql<number>`count(*)`.as('n') })
    .from(clientes)
    .get()
  const rPedidos = db
    .select({ n: sql<number>`count(*)`.as('n') })
    .from(pedidos)
    .get()
  const rFacturas = db
    .select({ n: sql<number>`count(*)`.as('n') })
    .from(facturas)
    .get()
  const rProveedores = db
    .select({ n: sql<number>`count(*)`.as('n') })
    .from(proveedores)
    .get()
  const rInventario = db
    .select({ n: sql<number>`count(*)`.as('n') })
    .from(inventario)
    .get()
  const rClases = db
    .select({ n: sql<number>`count(*)`.as('n') })
    .from(clases)
    .get()
  const rEstudiantes = db
    .select({ n: sql<number>`count(*)`.as('n') })
    .from(estudiantes)
    .get()
  const rContratos = db
    .select({ n: sql<number>`count(*)`.as('n') })
    .from(contratos)
    .get()

  return {
    clientes: Number(rClientes?.n ?? 0),
    pedidos: Number(rPedidos?.n ?? 0),
    facturas: Number(rFacturas?.n ?? 0),
    proveedores: Number(rProveedores?.n ?? 0),
    inventario: Number(rInventario?.n ?? 0),
    clases: Number(rClases?.n ?? 0),
    estudiantes: Number(rEstudiantes?.n ?? 0),
    contratos: Number(rContratos?.n ?? 0)
  }
}
