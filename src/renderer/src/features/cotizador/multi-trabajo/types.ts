// Tipos locales del flujo multi-trabajo. El estado vive en el wizard padre
// hasta que el usuario confirma — entonces se transforma en el payload del
// IPC `pedidos:crearMultiTrabajo`.
import type {
  Cliente,
  ResultadoCotizacion,
  TipoEntrega,
  TipoTrabajoConcreto,
  MetodoPago
} from '@shared/types'
import type { WizardData } from '../wizard/wizard-shell'

/**
 * Trabajo cotizado guardado en la sesión del wizard padre antes de
 * confirmar el pedido. El `id` local se usa para identificar la entrada en
 * la lista de la UI (eliminar/editar) — NO es el `trabajoId` que el backend
 * asigna al persistir (ese se calcula al insertar items, va de 1..N).
 */
export type TrabajoEnSesion = {
  /** Identificador local generado con `crypto.randomUUID()`. */
  idLocal: string
  tipoTrabajo: TipoTrabajoConcreto
  /** Datos del wizard que produjeron la cotización — necesarios para
   *  re-validar contra el backend (`cotizacionAutorizada`) y para precargar
   *  el modal en modo edición. */
  data: WizardData
  /** Resultado calculado por el cotizador. Inmutable: si el usuario edita
   *  un trabajo, se reemplaza la entrada completa con un re-cálculo. */
  cotizacion: ResultadoCotizacion
}

export type DescuentoEnSesion = {
  monto: number
  motivo: string
}

export type AbonoEnSesion = {
  monto: number
  metodoPago: MetodoPago
  fecha: string
}

/**
 * Estado del wizard multi-trabajo. Se persiste en localStorage cada vez
 * que cambia (auto-save), key = 'multitrabajo:wip'.
 */
export type EstadoMultiTrabajo = {
  cliente: Cliente | null
  trabajos: TrabajoEnSesion[]
  descuento: DescuentoEnSesion | null
  abono: AbonoEnSesion | null
  tipoEntrega: TipoEntrega
  notas: string
  fechaIngreso: string
  fechaEntrega: string | null
}

export const STORAGE_KEY_MULTITRABAJO = 'multitrabajo:wip'
