// Provider de "recientes" para el CommandPalette.
//
// Aparece cuando el palette se abre con query vacío. Muestra las últimas N
// entidades visitadas (clientes, pedidos, facturas, contratos), persistidas
// en localStorage por el hook `useRecentEntities`.
//
// Acepta un GETTER (no un snapshot) — el AppShell pasa una función que
// retorna los recientes actuales en cada llamada. Esto permite que
// `commandProviders` se memoice UNA SOLA VEZ sin depender de `recientes`,
// evitando rebuilds que reinician la búsqueda del palette cada vez que
// el usuario navega a una página detalle.
import { ClipboardList, FileSignature, Receipt, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  isRecentEntityKind,
  type RecentEntity,
  type RecentEntityKind
} from '@renderer/hooks/use-recent-entities'
import type { CommandProvider, CommandResult } from './command-providers'

const ICONO_POR_KIND: Record<RecentEntityKind, LucideIcon> = {
  cliente: Users,
  pedido: ClipboardList,
  factura: Receipt,
  contrato: FileSignature
}

const RUTA_POR_KIND: Record<RecentEntityKind, (id: number) => string> = {
  cliente: (id) => `/clientes/${id}`,
  pedido: (id) => `/pedidos/${id}`,
  factura: (id) => `/facturas/${id}`,
  contrato: (id) => `/contratos/${id}`
}

const MAX_VISIBLES = 5

export function createRecientesProvider(
  obtenerRecientes: () => RecentEntity[]
): CommandProvider {
  return {
    nombre: 'recientes',
    prioridad: 5, // antes que las acciones — son los items más relevantes para el contexto
    mostrarSinQuery: true,
    buscar: async (q) => {
      // Solo aparecen con query vacío. Con query, las entidades reales
      // (que sí buscan en backend) son la respuesta correcta.
      if (q.length > 0) return []
      const recientes = obtenerRecientes()
      // Defense-in-depth: aunque el store ya filtra kinds inválidos al leer
      // localStorage, blindamos también el provider para protegernos de
      // getters externos (tests, futuros consumers) que pasen entries no
      // validadas. Sin este filter, ICONO_POR_KIND[kind] = undefined y el
      // palette crashea al renderizar `<Icon />`.
      const validas = recientes.filter((r) => isRecentEntityKind(r.kind))
      return validas.slice(0, MAX_VISIBLES).map<CommandResult>((r) => ({
        id: `reciente:${r.kind}:${r.id}`,
        kind: 'navigation',
        seccion: 'Recientes',
        titulo: r.titulo,
        subtitulo: r.subtitulo ?? capitalizar(r.kind),
        icono: ICONO_POR_KIND[r.kind],
        ejecutar: ({ navigate, cerrar }) => {
          navigate(RUTA_POR_KIND[r.kind](r.id))
          cerrar()
        }
      }))
    }
  }
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
