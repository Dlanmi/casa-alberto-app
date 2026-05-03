import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightNav,
  ClipboardList,
  Palette,
  CalendarCheck,
  Users,
  Clock,
  Phone,
  MessageCircle,
  Wallet,
  UserPlus
} from 'lucide-react'
import { OperationalBoard } from '@renderer/components/layout/page-frame'
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Modal } from '@renderer/components/ui/modal'
import { PageLoader } from '@renderer/components/ui/spinner'
import { EstadoPedidoBadge } from '@renderer/components/shared/estado-badge'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useEstadisticasCliente } from '@renderer/hooks/use-estadisticas-cliente'
import { usePagosClasesMes } from '@renderer/hooks/use-pagos-clases-mes'
import { useAcudientes } from '@renderer/hooks/use-acudientes'
import { cn } from '@renderer/lib/cn'
import {
  hoyISO,
  formatFechaCorta,
  formatFechaLarga,
  formatCOP,
  toFechaISO
} from '@renderer/lib/format'
import {
  normalizePedidoAlertas,
  type PedidoAlertaNormalizada,
  type PedidoAlertaRow
} from '@renderer/lib/pedidos-alertas'
import {
  TIPO_TRABAJO_LABEL,
  TIPO_ENTREGA_LABEL,
  ESTADOS_EN_SEGUIMIENTO
} from '@renderer/lib/constants'
import {
  formatTelefonoInternacional,
  mensajeListoParaRecoger,
  mensajeRecordatorioCobro,
  mensajeRecordatorioEntrega,
  whatsappUrl
} from '@renderer/lib/whatsapp'
import type {
  Acudiente,
  Clase,
  Cliente,
  Estudiante,
  EstadoPedido,
  TipoTrabajo
} from '@shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

const DIA_INDEX: Record<string, number> = {
  lunes: 0,
  martes: 1,
  miercoles: 2,
  jueves: 3,
  viernes: 4,
  sabado: 5
}

const DIAS_LABEL_CORTO: Record<string, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sáb',
  domingo: 'Dom'
}

const DIAS_LABEL_LARGO: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo'
}

const DIAS_SEMANA_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']

// Polling de respaldo — complementa el refetch por `visibilitychange`. 60s
// es un balance entre frescura y carga. Agenda no tiene muchos writes por
// minuto, pero papá puede dejar la ventana abierta todo el día.
const AGENDA_REFETCH_INTERVAL_MS = 60_000

type AgendaFiltro = 'todos' | 'atrasadas' | 'hoy'

const FILTRO_LABEL: Record<AgendaFiltro, string> = {
  todos: 'Todos',
  atrasadas: 'Solo atrasadas',
  hoy: 'Solo hoy'
}

// Días de compra de marcos (Fase 2 — proveedores Alberto y Edimol pasan
// lunes y miércoles). Cuando el día vacío coincide, sugerimos usarlo para
// levantar el pedido semanal de marcos.
const DIAS_PROVEEDOR = new Set(['lunes', 'miercoles'])

function getEmptyMessage(args: {
  iso: string
  diaKey: string
  hoy: string
  filtro: AgendaFiltro
}): string {
  if (args.filtro === 'atrasadas') {
    return 'No hay entregas atrasadas en este día. Buen trabajo.'
  }
  if (args.filtro === 'hoy') {
    if (args.iso !== args.hoy) {
      return 'El filtro de hoy mantiene el detalle en la fecha actual.'
    }
    return 'Hoy no tienes eventos programados.'
  }
  if (args.iso === args.hoy) {
    if (DIAS_PROVEEDOR.has(args.diaKey)) {
      return 'Día tranquilo. Buen momento para pedir marcos a Alberto y Edimol.'
    }
    return 'Día tranquilo. Aprovecha para adelantar trabajos o llamar a clientes con saldo pendiente.'
  }
  if (args.iso < args.hoy) {
    return 'Sin actividad registrada este día.'
  }
  if (DIAS_PROVEEDOR.has(args.diaKey)) {
    return 'Aún no hay nada programado. Es día de proveedor: recuerda levantar el pedido si lo necesitas.'
  }
  return 'Aún no hay nada programado para este día.'
}

function getPedidosPorFechaEmptyMessage(filtro: AgendaFiltro): string {
  if (filtro === 'atrasadas') return 'No hay pedidos atrasados.'
  if (filtro === 'hoy') return 'No hay pedidos para hoy.'
  return 'No hay pedidos activos con fecha de entrega.'
}

function getPedidosResumenLabel(filtro: AgendaFiltro, count: number): string {
  if (filtro === 'atrasadas') return count === 1 ? 'pedido atrasado' : 'pedidos atrasados'
  if (filtro === 'hoy') return count === 1 ? 'pedido para hoy' : 'pedidos para hoy'
  return count === 1 ? 'pedido activo' : 'pedidos activos'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EstadoPagoMes = 'pagado' | 'parcial' | 'pendiente'

type EstudianteInfo = {
  id: number
  clienteId: number
  nombre: string
  esMenor: boolean
  estadoPagoMes: EstadoPagoMes
  acudiente: Acudiente | null
}

type DayClase = {
  tipo: 'clase'
  id: number
  nombre: string
  horaInicio: string
  horaFin: string
  estudiantesActivos: number
  estudiantes: EstudianteInfo[]
}

type DayPedido = {
  tipo: 'pedido'
  id: number
  numero: string
  clienteId: number
  cliente: string
  clienteTelefono: string
  estado: string
  tipoTrabajo: string
  descripcion: string
  precioTotal: number
  anchoCm: number
  altoCm: number
  tipoEntrega: string
  isAtrasada: boolean
  saldoPedido: number
  fechaEntrega: string
}

type DayEvent = DayClase | DayPedido

type DaySummary = {
  date: Date
  iso: string
  diaKey: string
  events: DayEvent[]
  claseCount: number
  pedidoCount: number
  atrasadaCount: number
}

type PedidoFechaGroup = {
  iso: string
  pedidos: DayPedido[]
}

// ---------------------------------------------------------------------------
// WeekNavigator — navigation + prominent "Hoy" button
// ---------------------------------------------------------------------------

function WeekNavigator({
  weekStart,
  onPrev,
  onNext,
  onToday
}: {
  weekStart: Date
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  const weekEnd = addDays(weekStart, 6)
  const desde = formatFechaCorta(toFechaISO(weekStart))
  const hasta = formatFechaCorta(toFechaISO(weekEnd))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" onClick={onPrev} aria-label="Semana anterior">
        <ChevronLeft size={18} />
      </Button>
      <span className="min-w-45 text-center text-sm font-semibold text-text">
        {desde} — {hasta}
      </span>
      <Button variant="outline" size="icon" onClick={onNext} aria-label="Semana siguiente">
        <ChevronRight size={18} />
      </Button>
      <Button variant="primary" onClick={onToday}>
        <CalendarCheck size={16} />
        Hoy
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// WeekOverviewCell — compact day card in the top row
// ---------------------------------------------------------------------------

function WeekOverviewCell({
  day,
  isToday,
  isSelected,
  disabled = false,
  onSelect
}: {
  day: DaySummary
  isToday: boolean
  isSelected: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  const dayNum = day.date.getDate()
  const total = day.claseCount + day.pedidoCount
  const hasAtrasadas = day.atrasadaCount > 0
  const ariaAtrasadas = hasAtrasadas
    ? `, ${day.atrasadaCount} ${day.atrasadaCount === 1 ? 'atrasada' : 'atrasadas'}`
    : ''

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-label={`${DIAS_LABEL_LARGO[day.diaKey]} ${dayNum}, ${total} ${total === 1 ? 'evento' : 'eventos'}${ariaAtrasadas}`}
      aria-pressed={isSelected}
      aria-disabled={disabled}
      className={cn(
        'relative flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-lg',
        'border px-2 py-3 transition-all duration-150 cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        isSelected
          ? 'border-accent bg-accent/8 ring-2 ring-accent shadow-1'
          : 'border-border bg-surface hover:bg-surface-muted hover:border-border',
        isToday && !isSelected && 'border-accent bg-accent/10 shadow-1',
        hasAtrasadas && !isSelected && 'border-error/60 bg-error-bg',
        disabled && 'cursor-not-allowed opacity-45 hover:bg-surface'
      )}
    >
      {hasAtrasadas && (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white"
        >
          {day.atrasadaCount}
        </span>
      )}

      {isToday && (
        <span
          aria-hidden
          className="absolute left-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
        >
          HOY
        </span>
      )}

      {/* Day abbreviation */}
      <span
        className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          isToday ? 'text-accent-strong' : 'text-text-soft'
        )}
      >
        {DIAS_LABEL_CORTO[day.diaKey]}
      </span>

      {/* Day number */}
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
          isToday ? 'bg-accent text-white shadow-1' : 'text-text'
        )}
      >
        {dayNum}
      </span>

      {/* Event dots */}
      {total > 0 && (
        <div className="flex items-center gap-1">
          {day.claseCount > 0 && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: Math.min(day.claseCount, 3) }).map((_, i) => (
                <span key={`c-${i}`} className="h-2 w-2 rounded-full bg-info" />
              ))}
            </div>
          )}
          {day.pedidoCount > 0 && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: Math.min(day.pedidoCount, 4) }).map((_, i) => (
                <span
                  key={`p-${i}`}
                  className={cn('h-2 w-2 rounded-full', hasAtrasadas ? 'bg-error' : 'bg-warning')}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Event count */}
      {total > 0 && <span className="text-xs font-medium text-text-muted">{total}</span>}
    </button>
  )
}

// ---------------------------------------------------------------------------
// DayDetailPanel — full detail view of the selected day
// ---------------------------------------------------------------------------

function DayDetailPanel({
  day,
  isToday,
  emptyMessage,
  onEventClick
}: {
  day: DaySummary
  isToday: boolean
  emptyMessage: string
  onEventClick: (event: DayEvent) => void
}) {
  const diaLargo = DIAS_LABEL_LARGO[day.diaKey]
  const fechaLarga = formatFechaLarga(day.iso)

  const clases = day.events.filter((e): e is DayClase => e.tipo === 'clase')
  const pedidos = day.events.filter((e): e is DayPedido => e.tipo === 'pedido')

  return (
    <Card padding="lg" className={cn(isToday && 'ring-2 ring-accent')}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-text">
            {diaLargo} {fechaLarga}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {day.events.length === 0
              ? 'No hay actividad programada'
              : `${day.events.length} ${day.events.length === 1 ? 'evento' : 'eventos'} programados`}
          </p>
        </div>
        {isToday && (
          <Badge color="info" size="md">
            Hoy
          </Badge>
        )}
      </div>

      {/* Clases section */}
      {clases.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <Palette size={16} className="text-info" />
            <h3 className="text-sm font-semibold text-text">Clases ({clases.length})</h3>
          </div>
          <div className="space-y-2">
            {clases.map((clase) => (
              <button
                key={`clase-${clase.id}`}
                type="button"
                onClick={() => onEventClick(clase)}
                className={cn(
                  'flex min-h-14 w-full items-center gap-4 rounded-lg border border-border',
                  'bg-surface px-4 py-3 text-left transition-colors duration-150',
                  'hover:bg-surface-muted hover:border-accent/30 cursor-pointer',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
                )}
              >
                <span className="h-3 w-3 shrink-0 rounded-full bg-info" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-text">{clase.nombre}</span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                    <span>
                      {clase.horaInicio} – {clase.horaFin}
                    </span>
                    <span>·</span>
                    <span>
                      {clase.estudiantesActivos}{' '}
                      {clase.estudiantesActivos === 1 ? 'estudiante activo' : 'estudiantes activos'}
                    </span>
                  </div>
                </div>
                <ChevronRightNav size={18} className="shrink-0 text-text-muted" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pedidos section */}
      {pedidos.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList size={16} className="text-warning" />
            <h3 className="text-sm font-semibold text-text">Entregas ({pedidos.length})</h3>
          </div>
          <div className="space-y-2">
            {pedidos.map((pedido) => (
              <button
                key={`pedido-${pedido.id}`}
                type="button"
                onClick={() => onEventClick(pedido)}
                className={cn(
                  'flex min-h-14 w-full items-center gap-4 rounded-lg border',
                  'px-4 py-3 text-left transition-colors duration-150 cursor-pointer',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  pedido.isAtrasada
                    ? 'border-error/60 bg-error-bg hover:bg-error-bg/80 hover:border-error'
                    : 'border-border bg-surface hover:bg-surface-muted hover:border-accent/30'
                )}
              >
                <span
                  className={cn(
                    'h-3 w-3 shrink-0 rounded-full',
                    pedido.isAtrasada ? 'bg-error' : 'bg-warning'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text">{pedido.numero}</span>
                    <span className="text-sm text-text-muted">· {pedido.cliente}</span>
                    {pedido.isAtrasada && (
                      <Badge color="error" size="sm">
                        ¡Atrasada!
                      </Badge>
                    )}
                    {!pedido.isAtrasada && pedido.tipoEntrega === 'urgente' && (
                      <Badge color="warning" size="sm">
                        Urgente
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-text-muted">{pedido.descripcion}</span>
                    <EstadoPedidoBadge estado={pedido.estado as EstadoPedido} />
                  </div>
                </div>
                <ChevronRightNav size={18} className="shrink-0 text-text-muted" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {day.events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarCheck size={40} className="mb-3 text-text-muted opacity-40" />
          <p className="max-w-md text-sm text-text-muted">{emptyMessage}</p>
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// ClasePopup — quick summary when clicking a class event
// ---------------------------------------------------------------------------

function ClasePopup({
  clase,
  open,
  onClose,
  onNavigate,
  onNavigateCliente
}: {
  clase: DayClase
  open: boolean
  onClose: () => void
  onNavigate: () => void
  onNavigateCliente: (clienteId: number) => void
}) {
  function llamarAcudiente(tel: string): void {
    const clean = tel.replace(/\D/g, '')
    if (clean.length >= 7) {
      void window.api.shell.openExternal(`tel:${clean}`)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={clase.nombre} size="sm">
      <div className="space-y-5">
        {/* Schedule */}
        <div className="flex items-center gap-3 rounded-lg bg-info-bg px-4 py-3">
          <Clock size={18} className="text-info-strong shrink-0" />
          <div>
            <p className="text-sm font-semibold text-text">
              {clase.horaInicio} – {clase.horaFin}
            </p>
            <p className="text-xs text-text-muted">Horario de la clase</p>
          </div>
        </div>

        {/* Students */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Users size={16} className="text-text-muted" />
            <h3 className="text-sm font-semibold text-text">
              Estudiantes ({clase.estudiantes.length})
            </h3>
          </div>
          {clase.estudiantes.length > 0 ? (
            <div className="space-y-1.5">
              {clase.estudiantes.map((est) => {
                const pagoColor =
                  est.estadoPagoMes === 'pagado'
                    ? 'success'
                    : est.estadoPagoMes === 'parcial'
                      ? 'warning'
                      : 'error'
                const pagoLabel =
                  est.estadoPagoMes === 'pagado'
                    ? 'Pagado'
                    : est.estadoPagoMes === 'parcial'
                      ? 'Parcial'
                      : 'Pendiente'
                return (
                  <div key={est.id} className="space-y-1.5 rounded-md bg-surface-muted px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent-strong">
                        {est.nombre
                          .split(' ')
                          .map((w) => w[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm text-text">
                        {est.nombre}
                      </span>
                      {est.esMenor && (
                        <Badge color="info" size="sm">
                          Menor
                        </Badge>
                      )}
                      <Badge color={pagoColor} size="sm">
                        {pagoLabel}
                      </Badge>
                    </div>
                    {est.esMenor && est.acudiente && est.acudiente.telefono && (
                      <div className="flex flex-wrap items-center gap-2 pl-11">
                        <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
                          Acudiente: {est.acudiente.nombre} — {est.acudiente.telefono}
                        </span>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => llamarAcudiente(est.acudiente!.telefono)}
                          aria-label={`Llamar a ${est.acudiente.nombre}, acudiente de ${est.nombre}`}
                        >
                          <Phone size={16} />
                          Llamar
                        </Button>
                      </div>
                    )}
                    {est.esMenor && !est.acudiente && (
                      <div className="pl-11">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onNavigateCliente(est.clienteId)}
                          aria-label={`Registrar acudiente para ${est.nombre}`}
                        >
                          <UserPlus size={14} />
                          Registrar acudiente
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-text-muted">
              No hay estudiantes registrados en esta clase.
            </p>
          )}
        </div>

        <Button size="lg" className="w-full" onClick={onNavigate}>
          <Palette size={18} />
          Ir a Clases
        </Button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// PedidoPopup — quick summary when clicking a pedido event
// ---------------------------------------------------------------------------

function PedidoPopup({
  pedido,
  open,
  onClose,
  onNavigate
}: {
  pedido: DayPedido
  open: boolean
  onClose: () => void
  onNavigate: () => void
}) {
  const telInternacional = formatTelefonoInternacional(pedido.clienteTelefono || null)
  const tieneTelefono = telInternacional !== null

  // Saldo acumulado del cliente en TODOS sus pedidos activos. Restando el
  // saldo de este pedido queda lo que debe en OTROS pedidos — papá no debería
  // entregar sin recordarle esa deuda paralela.
  const { data: estadisticasCliente } = useEstadisticasCliente(pedido.clienteId)
  const saldoOtrosPedidos = estadisticasCliente
    ? Math.max(0, estadisticasCliente.saldoPendiente - pedido.saldoPedido)
    : 0

  function handleLlamar(): void {
    if (!tieneTelefono) return
    const clean = pedido.clienteTelefono.replace(/\D/g, '')
    if (clean.length >= 7) {
      void window.api.shell.openExternal(`tel:${clean}`)
    }
  }

  // La plantilla WhatsApp depende del estado: `listo` usa un mensaje de
  // "pasa a recoger"; cualquier estado atrasado usa el tono disculpa-recogida;
  // el resto, el recordatorio amable.
  const whatsappLabel = pedido.isAtrasada
    ? 'Pedir disculpas'
    : pedido.estado === 'listo'
      ? 'Avisar que está listo'
      : 'Enviar recordatorio'

  function handleWhatsApp(): void {
    let mensaje: string
    if (pedido.estado === 'listo' && !pedido.isAtrasada) {
      mensaje = mensajeListoParaRecoger({
        nombreCliente: pedido.cliente,
        pedidoNumero: pedido.numero
      })
    } else {
      mensaje = mensajeRecordatorioEntrega({
        nombreCliente: pedido.cliente,
        pedidoNumero: pedido.numero,
        atrasada: pedido.isAtrasada
      })
    }
    const url = whatsappUrl(pedido.clienteTelefono, mensaje)
    if (url) {
      void window.api.shell.openExternal(url)
    }
  }

  // Botón separado para recordar saldo de OTROS pedidos (solo si existe).
  // Así papá tiene clara la diferencia entre "avisar de este pedido" y
  // "cobrar lo que debe aparte" sin mezclar mensajes.
  function handleWhatsAppCobro(): void {
    if (saldoOtrosPedidos <= 0) return
    const mensaje = mensajeRecordatorioCobro({
      nombreCliente: pedido.cliente,
      pedidoNumero: pedido.numero,
      saldo: saldoOtrosPedidos
    })
    const url = whatsappUrl(pedido.clienteTelefono, mensaje)
    if (url) {
      void window.api.shell.openExternal(url)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Pedido ${pedido.numero}`} size="sm">
      <div className="space-y-5">
        {pedido.isAtrasada && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-error/60 bg-error-bg px-4 py-3"
          >
            <Badge color="error" size="md">
              ¡Atrasada!
            </Badge>
            <span className="text-sm text-text">
              La fecha de entrega ya pasó y el pedido sigue activo.
            </span>
          </div>
        )}

        {/* Client */}
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-widest text-text-soft">Cliente</p>
          <p className="mt-1 text-base font-semibold text-text">{pedido.cliente}</p>
          {pedido.clienteTelefono && (
            <p className="mt-0.5 text-sm text-text-muted">{pedido.clienteTelefono}</p>
          )}
        </div>

        {saldoOtrosPedidos > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/60 bg-warning-bg px-4 py-3">
            <Wallet size={18} className="mt-0.5 shrink-0 text-warning-strong" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">
                Este cliente tiene{' '}
                <span className="tabular-nums text-warning-strong">
                  {formatCOP(saldoOtrosPedidos)}
                </span>{' '}
                pendiente en otros pedidos.
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                Aparte de la factura de este pedido. Aprovecha el contacto para recordar el saldo.
              </p>
            </div>
          </div>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border px-4 py-3">
            <p className="text-xs text-text-soft">Tipo de trabajo</p>
            <p className="mt-1 text-sm font-semibold text-text">
              {pedido.tipoTrabajo || 'No especificado'}
            </p>
          </div>
          <div className="rounded-lg border border-border px-4 py-3">
            <p className="text-xs text-text-soft">Medidas</p>
            <p className="mt-1 text-sm font-semibold text-text">
              {pedido.anchoCm > 0 && pedido.altoCm > 0
                ? `${pedido.anchoCm} × ${pedido.altoCm} cm`
                : 'No especificadas'}
            </p>
          </div>
          <div
            className={cn(
              'rounded-lg border px-4 py-3',
              pedido.tipoEntrega === 'urgente' && !pedido.isAtrasada
                ? 'border-warning/60 bg-warning-bg'
                : 'border-border'
            )}
          >
            <p className="text-xs text-text-soft">Entrega</p>
            <p
              className={cn(
                'mt-1 text-sm font-semibold',
                pedido.tipoEntrega === 'urgente' && !pedido.isAtrasada
                  ? 'text-warning-strong'
                  : 'text-text'
              )}
            >
              {TIPO_ENTREGA_LABEL[pedido.tipoEntrega] ?? pedido.tipoEntrega}
            </p>
          </div>
          <div className="rounded-lg border border-border px-4 py-3">
            <p className="text-xs text-text-soft">Estado</p>
            <div className="mt-1">
              <EstadoPedidoBadge estado={pedido.estado as EstadoPedido} />
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between rounded-lg bg-accent/8 px-4 py-3">
          <span className="text-sm font-medium text-text">Total del pedido</span>
          <span className="text-xl font-bold tabular-nums text-accent-strong">
            {formatCOP(pedido.precioTotal)}
          </span>
        </div>

        {tieneTelefono && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={handleLlamar}
                aria-label={`Llamar a ${pedido.cliente}`}
              >
                <Phone size={18} />
                Llamar
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleWhatsApp}
                aria-label={`Enviar WhatsApp a ${pedido.cliente}: ${whatsappLabel}`}
              >
                <MessageCircle size={18} />
                {whatsappLabel}
              </Button>
            </div>
            {saldoOtrosPedidos > 0 && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handleWhatsAppCobro}
                aria-label={`Enviar recordatorio de saldo por WhatsApp a ${pedido.cliente}`}
              >
                <MessageCircle size={18} />
                Recordar saldo pendiente
              </Button>
            )}
          </div>
        )}

        <Button size="lg" className="w-full" onClick={onNavigate}>
          <ClipboardList size={18} />
          Ver pedido completo
        </Button>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AgendaPage(): React.JSX.Element {
  const navigate = useNavigate()
  const hoy = hoyISO()
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [selectedISO, setSelectedISO] = useState<string>(hoy)

  const {
    data: pedidosAgendaRaw,
    loading: loadingPedidos,
    refetch: refetchPedidos
  } = useIpc<PedidoAlertaRow[]>(() => window.api.pedidos.agenda(), [])

  const {
    data: clases,
    loading: loadingClases,
    refetch: refetchClases
  } = useIpc<Clase[]>(() => window.api.clases.listar(true), [])

  // Saldo por pedido: una sola query agrega el saldo pendiente real
  // (factura − pagos − devoluciones) para todos los pedidos. Se usa para
  // calcular en el popup el "saldo de este pedido" y poder derivar si el
  // cliente además tiene deuda en otros pedidos.
  const { data: saldosPorPedido, refetch: refetchSaldos } = useIpc<
    Array<{ pedidoId: number; total: number; pagado: number; saldo: number }>
  >(() => window.api.pedidos.saldos(), [])

  const { data: estudiantes } = useIpc<Estudiante[]>(() => window.api.estudiantes.listar(true), [])
  const { data: clientesData } = useIpc<Cliente[]>(
    () => window.api.clientes.listar({ soloActivos: false }),
    []
  )

  // Pagos del mes actual — se usa para pintar el estado por estudiante en el
  // popup de clase (pagado/parcial/pendiente). Cubre solo los que YA tienen
  // un registro de pago del mes; los demás se tratan como 'pendiente' por
  // default (fallback del mes no generado aún).
  const { data: pagosMes } = usePagosClasesMes()

  // Acudientes registrados — necesarios en el popup de clase para mostrar
  // el teléfono del acudiente cuando el estudiante es menor. Batched en una
  // sola query; la tabla es pequeña (1 acudiente por cliente con menor).
  const { data: acudientesData } = useAcudientes()

  const pedidosGlobales = useMemo(
    () => normalizePedidoAlertas(pedidosAgendaRaw),
    [pedidosAgendaRaw]
  )

  const pedidosPorId = useMemo(() => {
    const map = new Map<number, { total: number; pagado: number; saldo: number }>()
    for (const saldo of saldosPorPedido ?? []) {
      map.set(saldo.pedidoId, saldo)
    }
    return map
  }, [saldosPorPedido])

  const estadosAtrasoAgenda = useMemo(
    () => new Set<EstadoPedido>([...ESTADOS_EN_SEGUIMIENTO, 'sin_reclamar']),
    []
  )

  const mapPedidoToDayPedido = useCallback(
    (row: PedidoAlertaNormalizada): DayPedido | null => {
      const pedido = row.pedido as Record<string, unknown>
      const cliente = row.cliente as Record<string, unknown> | null
      const fechaEntrega = typeof pedido.fechaEntrega === 'string' ? pedido.fechaEntrega : null
      if (!fechaEntrega) return null

      const tipoKey = pedido.tipoTrabajo as TipoTrabajo | undefined
      const tipoLabel = tipoKey ? (TIPO_TRABAJO_LABEL[tipoKey] ?? '') : ''
      const anchoCm = typeof pedido.anchoCm === 'number' ? pedido.anchoCm : 0
      const altoCm = typeof pedido.altoCm === 'number' ? pedido.altoCm : 0
      const dims = anchoCm > 0 && altoCm > 0 ? `${anchoCm}x${altoCm}` : ''
      const descripcionRaw = typeof pedido.descripcion === 'string' ? pedido.descripcion : ''
      const descripcion = [tipoLabel, dims].filter(Boolean).join(' ') || descripcionRaw
      const estado = ((typeof pedido.estado === 'string' ? pedido.estado : '') ||
        '') as EstadoPedido
      const pedidoId = typeof pedido.id === 'number' ? pedido.id : 0
      const saldo = pedidosPorId.get(pedidoId)?.saldo ?? 0

      return {
        tipo: 'pedido' as const,
        id: pedidoId,
        numero: typeof pedido.numero === 'string' ? pedido.numero : '?',
        clienteId: typeof pedido.clienteId === 'number' ? pedido.clienteId : 0,
        cliente: (typeof cliente?.nombre === 'string' ? cliente.nombre : '') ?? '',
        clienteTelefono: (typeof cliente?.telefono === 'string' ? cliente.telefono : '') ?? '',
        estado,
        tipoTrabajo: tipoLabel,
        descripcion,
        precioTotal: typeof pedido.precioTotal === 'number' ? pedido.precioTotal : 0,
        anchoCm,
        altoCm,
        tipoEntrega: (typeof pedido.tipoEntrega === 'string'
          ? pedido.tipoEntrega
          : 'estandar') as string,
        isAtrasada: fechaEntrega < hoy && estadosAtrasoAgenda.has(estado),
        saldoPedido: saldo,
        fechaEntrega
      }
    },
    [estadosAtrasoAgenda, hoy, pedidosPorId]
  )

  const pedidosGlobalesDia = useMemo(() => {
    return pedidosGlobales.flatMap((row) => {
      const mapped = mapPedidoToDayPedido(row)
      if (!mapped) return []
      return [mapped]
    })
  }, [mapPedidoToDayPedido, pedidosGlobales])

  // Build lookup: clienteId → nombre
  const clienteMap = useMemo(() => {
    const map = new Map<number, Cliente>()
    if (clientesData) {
      for (const c of clientesData) map.set(c.id, c)
    }
    return map
  }, [clientesData])

  // Lookup rápido del estado de pago del mes por estudianteId. Si no hay
  // registro todavía (el mes no se ha generado o el estudiante es nuevo),
  // se trata como 'pendiente' al leer más abajo.
  const pagoEstadoPorEstudiante = useMemo(() => {
    const map = new Map<number, EstadoPagoMes>()
    if (pagosMes) {
      for (const p of pagosMes) map.set(p.estudianteId, p.estado)
    }
    return map
  }, [pagosMes])

  // Lookup: clienteId → acudiente. Null si el cliente no tiene registrado.
  const acudientePorCliente = useMemo(() => {
    const map = new Map<number, Acudiente>()
    if (acudientesData) {
      for (const a of acudientesData) map.set(a.clienteId, a)
    }
    return map
  }, [acudientesData])

  // Build lookup: claseId → list of students with names
  const estudiantesPorClase = useMemo(() => {
    const map = new Map<number, EstudianteInfo[]>()
    if (estudiantes) {
      for (const est of estudiantes) {
        if (est.claseId != null) {
          const list = map.get(est.claseId) ?? []
          const cli = clienteMap.get(est.clienteId)
          list.push({
            id: est.id,
            clienteId: est.clienteId,
            nombre: cli?.nombre ?? 'Sin nombre',
            esMenor: est.esMenor,
            estadoPagoMes: pagoEstadoPorEstudiante.get(est.id) ?? 'pendiente',
            acudiente: acudientePorCliente.get(est.clienteId) ?? null
          })
          map.set(est.claseId, list)
        }
      }
    }
    return map
  }, [estudiantes, clienteMap, pagoEstadoPorEstudiante, acudientePorCliente])

  // Build DaySummary array for the 7 days
  const weekDays = useMemo((): DaySummary[] => {
    return DIAS_SEMANA_ORDEN.map((diaKey, i) => {
      const date = addDays(weekStart, i)
      const iso = toFechaISO(date)
      const events: DayEvent[] = []

      // Add clases for this day of the week
      if (clases) {
        for (const clase of clases) {
          const idx = DIA_INDEX[clase.diaSemana]
          if (idx === i) {
            const ests = estudiantesPorClase.get(clase.id) ?? []
            events.push({
              tipo: 'clase',
              id: clase.id,
              nombre: clase.nombre,
              horaInicio: clase.horaInicio,
              horaFin: clase.horaFin,
              estudiantesActivos: ests.length,
              estudiantes: ests
            })
          }
        }
      }

      // Add pedidos with fechaEntrega on this day
      for (const pedido of pedidosGlobalesDia) {
        if (pedido.fechaEntrega !== iso) continue
        events.push(pedido)
      }

      return {
        date,
        iso,
        diaKey,
        events,
        claseCount: events.filter((e) => e.tipo === 'clase').length,
        pedidoCount: events.filter((e) => e.tipo === 'pedido').length,
        atrasadaCount: events.filter((e): e is DayPedido => e.tipo === 'pedido' && e.isAtrasada)
          .length
      }
    })
  }, [clases, estudiantesPorClase, pedidosGlobalesDia, weekStart])

  const [popupEvent, setPopupEvent] = useState<DayEvent | null>(null)
  const [filtro, setFiltro] = useState<AgendaFiltro>('todos')
  const location = useLocation()
  // showEntregas controla si el Card "Entregas por completar" se muestra.
  // Por defecto está oculto (estado limpio). Se revela si el usuario activa
  // un filtro distinto de 'todos' o si se navega con `?action=ver-semana`.
  const [showEntregas, setShowEntregas] = useState<boolean>(() => {
    try {
      return new URLSearchParams(location.search).get('action') === 'ver-semana'
    } catch {
      return false
    }
  })

  // Derivación: aplica el filtro activo sobre cada día sin perder la
  // estructura semanal. Los contadores se recalculan para que la mini-card
  // refleje lo visible.
  const pedidosFiltradosGlobales = useMemo(() => {
    if (filtro === 'todos') return pedidosGlobalesDia
    if (filtro === 'atrasadas') return pedidosGlobalesDia.filter((pedido) => pedido.isAtrasada)
    return pedidosGlobalesDia.filter((pedido) => pedido.fechaEntrega === hoy)
  }, [filtro, hoy, pedidosGlobalesDia])

  const filteredWeekDays = useMemo((): DaySummary[] => {
    if (filtro === 'todos') return weekDays
    return weekDays.map((day) => {
      const clasesDelDia = day.events.filter((e): e is DayClase => e.tipo === 'clase')
      let pedidosDelDia = pedidosFiltradosGlobales.filter(
        (pedido) => pedido.fechaEntrega === day.iso
      )
      if (filtro === 'atrasadas') {
        pedidosDelDia = pedidosDelDia.filter((pedido) => pedido.isAtrasada)
      }
      const events: DayEvent[] = [...clasesDelDia, ...pedidosDelDia]
      return {
        ...day,
        events,
        claseCount: events.filter((e) => e.tipo === 'clase').length,
        pedidoCount: events.filter((e) => e.tipo === 'pedido').length,
        atrasadaCount: events.filter((e): e is DayPedido => e.tipo === 'pedido' && e.isAtrasada)
          .length
      }
    })
  }, [weekDays, filtro, pedidosFiltradosGlobales])

  const selectedDay = filteredWeekDays.find((d) => d.iso === selectedISO) ?? filteredWeekDays[0]

  const totalPedidosResumen = pedidosFiltradosGlobales.length
  const totalClasesSemana = clases ? clases.filter((c) => DIA_INDEX[c.diaSemana] != null).length : 0
  const totalAtrasadasSemana = useMemo(() => {
    return pedidosGlobalesDia.filter((pedido) => pedido.isAtrasada).length
  }, [pedidosGlobalesDia])

  const pedidosPorFecha = useMemo((): PedidoFechaGroup[] => {
    const map = new Map<string, DayPedido[]>()
    for (const pedido of pedidosFiltradosGlobales) {
      const list = map.get(pedido.fechaEntrega) ?? []
      list.push(pedido)
      map.set(pedido.fechaEntrega, list)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([iso, pedidos]) => ({
        iso,
        pedidos: [...pedidos].sort((a, b) => a.numero.localeCompare(b.numero))
      }))
  }, [pedidosFiltradosGlobales])

  const loading = loadingPedidos || loadingClases

  const handleGoToday = useCallback(() => {
    const mondayOfToday = getMonday(new Date())
    setWeekStart(mondayOfToday)
    setSelectedISO(hoyISO())
  }, [])

  const handleFiltro = useCallback(
    (key: AgendaFiltro) => {
      setPopupEvent(null)
      if (key === 'hoy') {
        handleGoToday()
      }
      if (key === 'atrasadas') {
        const primeraAtrasada = pedidosGlobalesDia
          .filter((pedido) => pedido.isAtrasada)
          .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega))[0]
        if (primeraAtrasada) {
          const fecha = new Date(`${primeraAtrasada.fechaEntrega}T00:00:00`)
          setWeekStart(getMonday(fecha))
          setSelectedISO(primeraAtrasada.fechaEntrega)
        }
      }
      setFiltro(key)
      // Reveal entregas when the user explicitly clicks any filter chip
      // (including 'todos'). This fixes the case where the initial state
      // is 'limpio' and clicking 'Todos' did nothing because no state
      // actually changed.
      setShowEntregas(true)
    },
    [handleGoToday, pedidosGlobalesDia]
  )

  const handleSelectDay = useCallback(
    (iso: string) => {
      if (filtro === 'hoy' && iso !== hoy) return
      setSelectedISO(iso)
    },
    [filtro, hoy]
  )

  const handlePrevDay = useCallback(() => {
    const current = new Date(`${selectedISO}T12:00:00`)
    const prev = addDays(current, -1)
    setSelectedISO(toFechaISO(prev))
  }, [selectedISO])

  const handleNextDay = useCallback(() => {
    const current = new Date(`${selectedISO}T12:00:00`)
    const next = addDays(current, 1)
    setSelectedISO(toFechaISO(next))
  }, [selectedISO])

  const handlePrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const newStart = addDays(prev, -7)
      // Select Monday of the new week
      setSelectedISO(toFechaISO(newStart))
      return newStart
    })
  }, [])

  const handleNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const newStart = addDays(prev, 7)
      // Select Monday of the new week
      setSelectedISO(toFechaISO(newStart))
      return newStart
    })
  }, [])

  const handleClearFilters = useCallback(() => {
    setFiltro('todos')
    setSelectedISO(hoy)
    setWeekStart(getMonday(new Date()))
    setPopupEvent(null)
    // Ensure the entregas section is hidden when clearing filters
    setShowEntregas(false)
    // Remove focus from any button so it doesn't look visually "selected".
    try {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    } catch {
      // noop in non-browser environments
    }
  }, [hoy])

  // Refetch automático: la agenda cambia durante el día (papá marca pedidos
  // como entregados desde otra vista, crea una clase, etc.). Refresca cuando
  // papá vuelve a la pestaña y cada AGENDA_REFETCH_INTERVAL_MS como respaldo.
  useEffect(() => {
    const tick = (): void => {
      refetchPedidos()
      refetchClases()
      refetchSaldos()
    }

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') tick()
    }

    document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(tick, AGENDA_REFETCH_INTERVAL_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
    }
  }, [refetchPedidos, refetchClases, refetchSaldos])

  return (
    <OperationalBoard
      eyebrow="Entregas y Clases"
      title="Agenda del día"
      subtitle="Ve hoy y planifica la semana. Gestiona entregas y horarios en un solo lugar."
    >
      {/* Navigator + summary */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <WeekNavigator
          weekStart={weekStart}
          onPrev={handlePrevWeek}
          onNext={handleNextWeek}
          onToday={handleGoToday}
        />
        <div className="flex items-center gap-4 text-sm text-text-muted">
          <span className="flex items-center gap-1.5">
            <ClipboardList size={16} className="text-warning" />
            {totalPedidosResumen} {getPedidosResumenLabel(filtro, totalPedidosResumen)}
          </span>
          <span className="flex items-center gap-1.5">
            <Palette size={16} className="text-info" />
            {totalClasesSemana} {totalClasesSemana === 1 ? 'clase' : 'clases'}
          </span>
        </div>
      </div>

      {/* Filter chips */}
      <div
        role="group"
        aria-label="Filtros de la agenda"
        className="flex flex-wrap items-center gap-2"
      >
        {(Object.keys(FILTRO_LABEL) as AgendaFiltro[]).map((key) => {
          // Visual active state: only show a chip as active when the
          // entregas section is visible. Cuando la vista está "limpia"
          // no queremos que "Todos" aparezca seleccionado.
          const isActive = showEntregas && filtro === key
          const isAtrasadas = key === 'atrasadas'
          return (
            <button
              key={key}
              type="button"
              onClick={() => handleFiltro(key)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium',
                'transition-colors duration-150 cursor-pointer',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isActive
                  ? 'border-accent bg-accent text-white shadow-1'
                  : 'border-border bg-surface text-text hover:bg-surface-muted'
              )}
            >
              {FILTRO_LABEL[key]}
              {isAtrasadas && totalAtrasadasSemana > 0 && (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold',
                    isActive ? 'bg-white text-error-strong' : 'bg-error text-white'
                  )}
                >
                  {totalAtrasadasSemana}
                </span>
              )}
            </button>
          )
        })}
        {filtro !== 'todos' && (
          <button
            type="button"
            onClick={handleClearFilters}
            className={cn(
              'inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium',
              'transition-colors duration-150 cursor-pointer',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              'border-border bg-surface text-text-muted hover:bg-surface-muted hover:text-text'
            )}
            aria-label="Limpiar filtros"
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          {/* Day detail panel — PRIMERO, acción inmediata */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 className="text-lg font-bold text-text">Hoy</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevDay}
                aria-label="Día anterior"
                title="Día anterior"
              >
                <ChevronLeft size={18} />
              </Button>
              <span className="min-w-32 text-center text-sm font-semibold text-text-muted">
                {formatFechaCorta(selectedISO)}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNextDay}
                aria-label="Día siguiente"
                title="Día siguiente"
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          </div>

          {/* Week overview — calendario interactivo */}
          <div className="pt-2">
            <div
              className="grid grid-cols-7 gap-1 sm:gap-2"
              role="listbox"
              aria-label="Dias de la semana"
            >
              {filteredWeekDays.map((day) => (
                <WeekOverviewCell
                  key={day.diaKey}
                  day={day}
                  isToday={day.iso === hoy}
                  isSelected={day.iso === selectedISO}
                  disabled={filtro === 'hoy' && day.iso !== hoy}
                  onSelect={() => handleSelectDay(day.iso)}
                />
              ))}
            </div>
          </div>

          <DayDetailPanel
            day={selectedDay}
            isToday={selectedDay.iso === hoy}
            emptyMessage={getEmptyMessage({
              iso: selectedDay.iso,
              diaKey: selectedDay.diaKey,
              hoy,
              filtro
            })}
            onEventClick={(event) => setPopupEvent(event)}
          />

          {/* Entregas por fecha */}
          {showEntregas && (
            <Card className="animate-scale-pop space-y-4 border-accent/20 bg-linear-to-br from-surface via-surface to-accent/5 p-5 shadow-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                    <ClipboardList size={22} className="text-warning-strong" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text">Entregas para completar</h2>
                    <p className="mt-0.5 text-sm text-text-muted">
                      {filtro === 'todos'
                        ? 'Pedidos activos agrupados por fecha de entrega.'
                        : filtro === 'atrasadas'
                          ? 'Pedidos vencidos en seguimiento. ⚠️ Requieren acción inmediata.'
                          : 'Entregas programadas para hoy.'}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-bold tabular-nums',
                    filtro === 'atrasadas' && totalAtrasadasSemana > 0
                      ? 'bg-error text-white'
                      : 'bg-accent text-white'
                  )}
                >
                  {pedidosFiltradosGlobales.length}
                </span>
              </div>
              {pedidosPorFecha.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center">
                  <ClipboardList size={32} className="mb-3 text-text-muted opacity-40" />
                  <p className="text-sm font-medium text-text-muted">
                    {getPedidosPorFechaEmptyMessage(filtro)}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pedidosPorFecha.map((grupo) => (
                    <div key={grupo.iso} className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedISO(grupo.iso)
                          setWeekStart(getMonday(new Date(`${grupo.iso}T00:00:00`)))
                        }}
                        className={cn(
                          'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                          grupo.iso < hoy && grupo.pedidos.some((p) => p.isAtrasada)
                            ? 'hover:bg-error/8 bg-error-bg/30'
                            : 'hover:bg-accent/8 bg-accent/3'
                        )}
                      >
                        <div>
                          <span className="text-sm font-bold text-text">
                            {formatFechaLarga(grupo.iso)}
                          </span>
                          {grupo.iso < hoy && grupo.pedidos.some((p) => p.isAtrasada) && (
                            <span className="ml-2 inline-block text-xs font-semibold text-error">
                              ⚠️ Atrasada
                            </span>
                          )}
                        </div>
                        <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-accent-strong">
                          {grupo.pedidos.length}{' '}
                          {grupo.pedidos.length === 1 ? 'entrega' : 'entregas'}
                        </span>
                      </button>
                      <div className="space-y-2">
                        {grupo.pedidos.map((pedido) => {
                          const saldoDisplay =
                            pedido.saldoPedido > 0
                              ? `${formatCOP(pedido.saldoPedido)} pendiente`
                              : 'Cobrado'
                          return (
                            <button
                              key={`${grupo.iso}-${pedido.id}`}
                              type="button"
                              onClick={() => setPopupEvent(pedido)}
                              className={cn(
                                'group relative flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3.5 text-left transition-all duration-150',
                                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                                pedido.isAtrasada
                                  ? 'border-error/40 bg-error-bg hover:border-error/60 hover:bg-error-bg/80 shadow-1'
                                  : 'border-border bg-surface hover:border-accent/30 hover:bg-surface-muted hover:shadow-1'
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-text">
                                  {pedido.numero} · {pedido.cliente}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-text-muted">
                                  {pedido.descripcion}
                                </p>
                                <p
                                  className={cn(
                                    'mt-1 text-xs font-semibold tabular-nums',
                                    pedido.saldoPedido > 0 ? 'text-warning-strong' : 'text-success'
                                  )}
                                >
                                  {saldoDisplay}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  {pedido.isAtrasada && (
                                    <Badge color="error" size="sm">
                                      Atrasada
                                    </Badge>
                                  )}
                                  <EstadoPedidoBadge estado={pedido.estado as EstadoPedido} />
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Popups */}
      {popupEvent?.tipo === 'clase' && (
        <ClasePopup
          clase={popupEvent}
          open
          onClose={() => setPopupEvent(null)}
          onNavigate={() => {
            setPopupEvent(null)
            navigate('/clases')
          }}
          onNavigateCliente={(clienteId) => {
            setPopupEvent(null)
            navigate(`/clientes/${clienteId}`)
          }}
        />
      )}
      {popupEvent?.tipo === 'pedido' && (
        <PedidoPopup
          pedido={popupEvent}
          open
          onClose={() => setPopupEvent(null)}
          onNavigate={() => {
            setPopupEvent(null)
            navigate(`/pedidos/${popupEvent.id}`)
          }}
        />
      )}
    </OperationalBoard>
  )
}
