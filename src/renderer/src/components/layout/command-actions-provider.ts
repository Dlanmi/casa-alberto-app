// Provider de "acciones rápidas" para el CommandPalette.
//
// A diferencia de los providers de entidad, este aparece SIEMPRE que el
// palette está abierto (con o sin query). Su rol es ofrecer atajos al
// "siguiente paso" típico: nueva cotización, nuevo cliente, abrir help.
//
// El provider es una factory que recibe del AppShell los callbacks para
// acciones que requieren estado del shell (ej. abrir el overlay de atajos).
// Las acciones de navegación pura usan `ruta` con un query-string flag
// que la página destino lee con `useQueryFlag`.
import {
  Calculator,
  FileSignature,
  GraduationCap,
  Keyboard,
  Palette,
  Receipt,
  Truck,
  UserPlus,
  Wallet
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ROUTES } from '@renderer/lib/constants'
import { formatPrimaryShortcut } from '@renderer/lib/shortcuts'
import type { CommandProvider, CommandResult } from './command-providers'

type ActionDef = {
  id: string
  titulo: string
  subtitulo?: string
  // Palabras clave para matching case-insensitive — sinónimos en español
  // que tu papá usaría naturalmente.
  keywords: string[]
  icono: LucideIcon
  // Modo de ejecución:
  //   - { tipo: 'navigate', ruta: '/clientes?nuevo=1' } — abre la página y
  //     deja que `useQueryFlag` haga el resto.
  //   - { tipo: 'callback', accion: 'verAtajos' } — invoca un callback
  //     pasado por el shell en `CommandActionsContext`.
  exec: { tipo: 'navigate'; ruta: string } | { tipo: 'callback'; accion: keyof CommandActionsContext }
  shortcut?: string
}

// Callbacks que el provider puede invocar. Se pasan desde el AppShell al
// crear el provider con `createAccionesProvider(ctx)`.
export type CommandActionsContext = {
  verAtajos: () => void
}

function shiftPrimary(letra: string): string {
  return formatPrimaryShortcut(`Shift+${letra.toUpperCase()}`)
}

const ACCIONES: ActionDef[] = [
  {
    id: 'nueva-cotizacion',
    titulo: 'Nueva cotización',
    subtitulo: 'Empezar el wizard del cotizador',
    keywords: ['nueva', 'nuevo', 'cotizacion', 'cotización', 'cotizar', 'presupuesto', 'wizard'],
    icono: Calculator,
    exec: { tipo: 'navigate', ruta: ROUTES.cotizador },
    shortcut: formatPrimaryShortcut('n')
  },
  {
    id: 'nuevo-cliente',
    titulo: 'Nuevo cliente',
    subtitulo: 'Registrar persona o empresa',
    keywords: ['nuevo', 'cliente', 'persona', 'crear', 'registrar'],
    icono: UserPlus,
    exec: { tipo: 'navigate', ruta: `${ROUTES.clientes}?nuevo=1` },
    shortcut: shiftPrimary('c')
  },
  {
    id: 'nueva-factura',
    titulo: 'Nueva factura',
    subtitulo: 'Generar factura desde cero',
    keywords: ['nueva', 'factura', 'cobrar', 'recibo'],
    icono: Receipt,
    exec: { tipo: 'navigate', ruta: `${ROUTES.facturas}?nueva=1` },
    shortcut: shiftPrimary('f')
  },
  {
    id: 'nuevo-proveedor',
    titulo: 'Nuevo proveedor',
    subtitulo: 'Registrar suministrador',
    keywords: ['nuevo', 'proveedor', 'suministrador', 'aliado'],
    icono: Truck,
    exec: { tipo: 'navigate', ruta: `${ROUTES.proveedores}?nuevo=1` },
    shortcut: shiftPrimary('v')
  },
  {
    id: 'nuevo-pedido',
    titulo: 'Nuevo pedido (cotizar)',
    subtitulo: 'Atajo al cotizador',
    keywords: ['nuevo', 'pedido', 'orden', 'trabajo'],
    icono: Wallet,
    exec: { tipo: 'navigate', ruta: ROUTES.cotizador },
    shortcut: shiftPrimary('p')
  },
  {
    id: 'nueva-clase',
    titulo: 'Nueva clase',
    subtitulo: 'Crear horario de clase',
    keywords: ['nueva', 'clase', 'horario', 'taller'],
    icono: Palette,
    exec: { tipo: 'navigate', ruta: `${ROUTES.clases}?nueva=1` }
  },
  {
    id: 'nuevo-estudiante',
    titulo: 'Nuevo estudiante',
    subtitulo: 'Inscribir alumno',
    keywords: ['nuevo', 'estudiante', 'alumno', 'inscribir'],
    icono: GraduationCap,
    exec: { tipo: 'navigate', ruta: `${ROUTES.clases}?estudiante=1` }
  },
  {
    id: 'nuevo-contrato',
    titulo: 'Nuevo contrato',
    subtitulo: 'Crear contrato corporativo',
    keywords: ['nuevo', 'contrato', 'corporativo', 'empresa'],
    icono: FileSignature,
    exec: { tipo: 'navigate', ruta: `${ROUTES.contratos}?nuevo=1` }
  },
  {
    id: 'ver-atajos',
    titulo: 'Ver atajos de teclado',
    subtitulo: 'Lista completa de atajos',
    keywords: ['atajos', 'shortcuts', 'ayuda', 'help', 'teclado'],
    icono: Keyboard,
    exec: { tipo: 'callback', accion: 'verAtajos' },
    shortcut: formatPrimaryShortcut('/')
  }
]

const MAX_ACCIONES_VISIBLES = 6

function matchAccion(accion: ActionDef, queryLower: string): boolean {
  if (queryLower.length === 0) return true
  const haystack = [
    accion.titulo.toLowerCase(),
    ...(accion.subtitulo ? [accion.subtitulo.toLowerCase()] : []),
    ...accion.keywords.map((k) => k.toLowerCase())
  ]
  return haystack.some((h) => h.includes(queryLower))
}

export function createAccionesProvider(ctx: CommandActionsContext): CommandProvider {
  return {
    nombre: 'acciones',
    prioridad: 10, // primero visualmente — son atajos al "siguiente paso"
    mostrarSinQuery: true,
    buscar: async (q) => {
      const queryLower = q.toLowerCase()
      const matches = ACCIONES.filter((a) => matchAccion(a, queryLower)).slice(
        0,
        MAX_ACCIONES_VISIBLES
      )
      return matches.map<CommandResult>((a) => ({
        id: `accion:${a.id}`,
        kind: 'action',
        seccion: 'Acciones',
        titulo: a.titulo,
        subtitulo: a.subtitulo,
        icono: a.icono,
        shortcut: a.shortcut,
        ejecutar: ({ navigate, cerrar }) => {
          // Try-catch defensivo — si el callback (ej. `verAtajos`) tira por
          // cualquier motivo, no queremos dejar el palette atrapado abierto.
          // Logueamos y siempre llamamos `cerrar()` en finally.
          try {
            if (a.exec.tipo === 'navigate') {
              navigate(a.exec.ruta)
            } else {
              ctx[a.exec.accion]()
            }
          } catch (err) {
            console.error(`Acción "${a.id}" falló al ejecutarse:`, err)
          } finally {
            cerrar()
          }
        }
      }))
    }
  }
}
