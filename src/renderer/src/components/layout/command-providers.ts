// Sistema de proveedores para la búsqueda global del CommandPalette.
//
// Cada entidad o acción se modela como un CommandProvider independiente. El
// palette no conoce los tipos concretos: invoca `buscar(query)` en cada
// provider en paralelo, agrupa los resultados por sección y los presenta en
// una lista plana navegable con teclado.
//
// Beneficio: agregar una nueva entidad (proveedores, contratos, clases…) o
// una acción (registrar pago, abrir help) NO requiere tocar el palette,
// solo registrar un nuevo provider en `getDefaultProviders()`.
import type { LucideIcon } from 'lucide-react'
import {
  ClipboardList,
  FileSignature,
  GraduationCap,
  Palette,
  Receipt,
  Truck,
  Users
} from 'lucide-react'
import type { Cliente, Factura, IpcResult, Pedido, Proveedor } from '@shared/types'
import { formatTelefono } from '@renderer/lib/format'

// -- Tipos -------------------------------------------------------------------

export type CommandResultKind = 'navigation' | 'action' | 'entity'

export type CommandResult = {
  // ID estable y único en el palette (ej. "cliente:42", "accion:nuevo-pedido").
  // Lo usamos como key de React y para construir IDs de aria-activedescendant.
  id: string
  kind: CommandResultKind
  // Sección a la que pertenece visualmente (ej. "Clientes", "Acciones").
  // Puede ser distinta del nombre del provider (un provider puede ofrecer
  // resultados en varias secciones — las acciones, por ejemplo).
  seccion: string
  titulo: string
  subtitulo?: string
  icono: LucideIcon
  // Texto del atajo cuando aplica (ej. "Ctrl+K"). Solo presentación.
  shortcut?: string
  ejecutar: (ctx: CommandContext) => void
}

// Contexto que el palette pasa a cada `ejecutar`. Permite que los resultados
// disparen navegación, abran modales, etc., sin acoplar a react-router en el
// modelo de provider.
export type CommandContext = {
  navigate: (path: string) => void
  cerrar: () => void
}

export type CommandProvider = {
  nombre: string
  // Prioridad de ordenamiento de secciones (menor = aparece arriba).
  // Las acciones suelen ir primero porque son atajos al "siguiente paso".
  prioridad: number
  // Si devuelve resultados con query vacío (ej. recientes, acciones top).
  // Falso por defecto — entidades NO se listan sin query para no saturar.
  mostrarSinQuery?: boolean
  buscar: (query: string) => Promise<CommandResult[]>
}

// -- Helpers internos --------------------------------------------------------

// Ejecuta `Promise.all` con un timeout por provider para que un endpoint
// lento no bloquee el palette completo. Los providers que excedan el timeout
// devuelven [] silenciosamente.
const PROVIDER_TIMEOUT_MS = 1500

async function buscarConTimeout(
  provider: CommandProvider,
  query: string
): Promise<CommandResult[]> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve([]), PROVIDER_TIMEOUT_MS)
    provider
      .buscar(query)
      .then((res) => {
        clearTimeout(timer)
        resolve(res)
      })
      .catch((err) => {
        clearTimeout(timer)
        console.error(`Provider "${provider.nombre}" falló:`, err)
        resolve([])
      })
  })
}

// Ejecuta todos los providers en paralelo y devuelve los resultados aplanados.
// Los providers definen su propia sección, así que aquí solo concatenamos.
export async function ejecutarProviders(
  providers: CommandProvider[],
  query: string
): Promise<CommandResult[]> {
  const queryLimpio = query.trim()
  const aplicables = providers.filter((p) => queryLimpio.length > 0 || p.mostrarSinQuery)
  const grupos = await Promise.all(aplicables.map((p) => buscarConTimeout(p, queryLimpio)))
  return grupos.flat()
}

// Agrupa una lista plana de resultados por sección preservando el orden de
// aparición. Devuelve los resultados en orden visual (sección por sección)
// para que la navegación con flechas no salte entre grupos visuales.
export function agruparPorSeccion(
  resultados: CommandResult[]
): { seccion: string; items: CommandResult[] }[] {
  const orden: string[] = []
  const buckets = new Map<string, CommandResult[]>()
  for (const r of resultados) {
    if (!buckets.has(r.seccion)) {
      buckets.set(r.seccion, [])
      orden.push(r.seccion)
    }
    buckets.get(r.seccion)!.push(r)
  }
  return orden.map((seccion) => ({ seccion, items: buckets.get(seccion)! }))
}

// Aplana grupos a la lista visual ordenada — útil para navegación con flechas.
export function aplanar(grupos: { seccion: string; items: CommandResult[] }[]): CommandResult[] {
  return grupos.flatMap((g) => g.items)
}

// -- Providers de entidades --------------------------------------------------

const LIMIT_RESULTADOS = 6

export const clientesProvider: CommandProvider = {
  nombre: 'clientes',
  prioridad: 20,
  buscar: async (q) => {
    if (q.length < 2) return []
    const res = (await window.api.clientes.listar({
      busqueda: q,
      limit: LIMIT_RESULTADOS
    })) as IpcResult<Cliente[]>
    if (!res.ok) return []
    return res.data.map((c) => ({
      id: `cliente:${c.id}`,
      kind: 'entity' as const,
      seccion: 'Clientes',
      titulo: c.nombre,
      subtitulo: c.telefono ? formatTelefono(c.telefono) : 'Cliente',
      icono: Users,
      ejecutar: ({ navigate, cerrar }) => {
        navigate(`/clientes/${c.id}`)
        cerrar()
      }
    }))
  }
}

export const pedidosProvider: CommandProvider = {
  nombre: 'pedidos',
  prioridad: 30,
  buscar: async (q) => {
    if (q.length < 2) return []
    const res = (await window.api.pedidos.listar({
      busqueda: q,
      limit: LIMIT_RESULTADOS
    })) as IpcResult<Pedido[]>
    if (!res.ok) return []
    return res.data.map((p) => ({
      id: `pedido:${p.id}`,
      kind: 'entity' as const,
      seccion: 'Pedidos',
      titulo: `${p.numero} — ${p.descripcion ?? 'Sin descripción'}`,
      subtitulo: 'Pedido',
      icono: ClipboardList,
      ejecutar: ({ navigate, cerrar }) => {
        navigate(`/pedidos/${p.id}`)
        cerrar()
      }
    }))
  }
}

export const facturasProvider: CommandProvider = {
  nombre: 'facturas',
  prioridad: 40,
  buscar: async (q) => {
    if (q.length < 2) return []
    const res = (await window.api.facturas.listar({
      busqueda: q,
      limit: LIMIT_RESULTADOS
    })) as IpcResult<Factura[]>
    if (!res.ok) return []
    return res.data.map((f) => ({
      id: `factura:${f.id}`,
      kind: 'entity' as const,
      seccion: 'Facturas',
      titulo: f.numero,
      subtitulo: 'Factura',
      icono: Receipt,
      ejecutar: ({ navigate, cerrar }) => {
        navigate(`/facturas/${f.id}`)
        cerrar()
      }
    }))
  }
}

export const proveedoresProvider: CommandProvider = {
  nombre: 'proveedores',
  prioridad: 50,
  buscar: async (q) => {
    if (q.length < 2) return []
    const res = (await window.api.proveedores.listar({
      busqueda: q,
      limit: LIMIT_RESULTADOS
    })) as IpcResult<Proveedor[]>
    if (!res.ok) return []
    return res.data.map((p) => ({
      id: `proveedor:${p.id}`,
      kind: 'entity' as const,
      seccion: 'Proveedores',
      titulo: p.nombre,
      subtitulo: p.tipo ?? 'Proveedor',
      icono: Truck,
      ejecutar: ({ navigate, cerrar }) => {
        navigate(`/proveedores`)
        cerrar()
      }
    }))
  }
}

// Para clases y estudiantes los IPC actuales devuelven listas planas; las
// filtramos pasando `busqueda`. El renderer no tiene rutas detalle hoy, así
// que la ejecución navega al listado del módulo.
type ClaseRow = { id: number; nombre: string; diaSemana: string }
type EstudianteRow = { id: number; clienteId: number }

export const clasesProvider: CommandProvider = {
  nombre: 'clases',
  prioridad: 60,
  buscar: async (q) => {
    if (q.length < 2) return []
    const res = (await window.api.clases.listar({
      busqueda: q,
      limit: LIMIT_RESULTADOS
    })) as IpcResult<ClaseRow[]>
    if (!res.ok) return []
    return res.data.map((c) => ({
      id: `clase:${c.id}`,
      kind: 'entity' as const,
      seccion: 'Clases',
      titulo: c.nombre,
      subtitulo: `Clase · ${c.diaSemana}`,
      icono: Palette,
      ejecutar: ({ navigate, cerrar }) => {
        navigate(`/clases`)
        cerrar()
      }
    }))
  }
}

export const estudiantesProvider: CommandProvider = {
  nombre: 'estudiantes',
  prioridad: 65,
  buscar: async (q) => {
    if (q.length < 2) return []
    // `Promise.allSettled` (en vez de `Promise.all`) garantiza que si UNA
    // de las dos calls THROW (rechazo, no `ok:false`), la otra sigue su
    // curso y el provider devuelve resultados parciales en lugar de fallar
    // silenciosamente. Antes con `Promise.all`, un throw del IPC dejaba el
    // provider con [] sin razón visible.
    const [estSettled, cliSettled] = await Promise.allSettled([
      window.api.estudiantes.listar({ busqueda: q, limit: LIMIT_RESULTADOS }) as Promise<
        IpcResult<EstudianteRow[]>
      >,
      window.api.clientes.listar({ busqueda: q, limit: LIMIT_RESULTADOS * 2 }) as Promise<
        IpcResult<Cliente[]>
      >
    ])

    // Sin estudiantes válidos, no hay nada que mostrar. Logueamos para
    // debug pero no bloqueamos al usuario.
    if (estSettled.status !== 'fulfilled') {
      console.warn('estudiantesProvider: estudiantes.listar falló', estSettled.reason)
      return []
    }
    if (!estSettled.value.ok || estSettled.value.data.length === 0) return []

    const res = estSettled.value
    const clienteMap = new Map<number, string>()
    if (cliSettled.status === 'fulfilled' && cliSettled.value.ok) {
      for (const c of cliSettled.value.data) clienteMap.set(c.id, c.nombre)
    } else if (cliSettled.status === 'rejected') {
      console.warn('estudiantesProvider: clientes.listar falló', cliSettled.reason)
    }
    return res.data.map((e) => ({
      id: `estudiante:${e.id}`,
      kind: 'entity' as const,
      seccion: 'Estudiantes',
      titulo: clienteMap.get(e.clienteId) ?? `Estudiante #${e.id}`,
      subtitulo: 'Estudiante',
      icono: GraduationCap,
      ejecutar: ({ navigate, cerrar }) => {
        navigate(`/clases`)
        cerrar()
      }
    }))
  }
}

type ContratoRow = { id: number; numero: string; descripcion?: string | null }

export const contratosProvider: CommandProvider = {
  nombre: 'contratos',
  prioridad: 70,
  buscar: async (q) => {
    if (q.length < 2) return []
    // Filtro server-side via LIKE — antes traíamos TODOS los contratos y
    // filtrábamos en cliente, lo que escalaba mal con el dataset.
    const res = (await window.api.contratos.listar({
      busqueda: q,
      limit: LIMIT_RESULTADOS
    })) as IpcResult<ContratoRow[]>
    if (!res.ok) return []
    return res.data.map((c) => ({
      id: `contrato:${c.id}`,
      kind: 'entity' as const,
      seccion: 'Contratos',
      titulo: c.numero,
      subtitulo: c.descripcion ?? 'Contrato',
      icono: FileSignature,
      ejecutar: ({ navigate, cerrar }) => {
        navigate(`/contratos`)
        cerrar()
      }
    }))
  }
}

// -- Conjuntos default -------------------------------------------------------

// Set por defecto cuando se monta el palette en el AppShell. Los providers de
// acciones y recientes se inyectan desde otros archivos para mantener bajo
// el acoplamiento (este archivo no debe importar React, useNavigate, etc).
export function getEntityProviders(): CommandProvider[] {
  return [
    clientesProvider,
    pedidosProvider,
    facturasProvider,
    proveedoresProvider,
    clasesProvider,
    estudiantesProvider,
    contratosProvider
  ]
}
