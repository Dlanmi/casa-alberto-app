import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightNav,
  ClipboardList,
  Palette,
  CalendarCheck,
  Users,
  Clock
} from 'lucide-react'
import { OperationalBoard } from '@renderer/components/layout/page-frame'
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Modal } from '@renderer/components/ui/modal'
import { PageLoader } from '@renderer/components/ui/spinner'
import { EstadoPedidoBadge } from '@renderer/components/shared/estado-badge'
import { useIpc } from '@renderer/hooks/use-ipc'
import { cn } from '@renderer/lib/cn'
import { hoyISO, formatFechaCorta, formatFechaLarga, formatCOP } from '@renderer/lib/format'
import { normalizePedidoAlertas, type PedidoAlertaRow } from '@renderer/lib/pedidos-alertas'
import { TIPO_TRABAJO_LABEL } from '@renderer/lib/constants'
import type { Clase, Cliente, Estudiante, EstadoPedido, TipoTrabajo } from '@shared/types'

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

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EstudianteInfo = {
  id: number
  nombre: string
  esMenor: boolean
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
  cliente: string
  clienteTelefono: string
  estado: string
  tipoTrabajo: string
  descripcion: string
  precioTotal: number
  anchoCm: number
  altoCm: number
  tipoEntrega: string
}

type DayEvent = DayClase | DayPedido

type DaySummary = {
  date: Date
  iso: string
  diaKey: string
  events: DayEvent[]
  claseCount: number
  pedidoCount: number
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
  const desde = formatFechaCorta(toISO(weekStart))
  const hasta = formatFechaCorta(toISO(weekEnd))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" onClick={onPrev} aria-label="Semana anterior">
        <ChevronLeft size={18} />
      </Button>
      <span className="min-w-[180px] text-center text-sm font-semibold text-text">
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
  onSelect
}: {
  day: DaySummary
  isToday: boolean
  isSelected: boolean
  onSelect: () => void
}) {
  const dayNum = day.date.getDate()
  const total = day.claseCount + day.pedidoCount

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${DIAS_LABEL_LARGO[day.diaKey]} ${dayNum}, ${total} ${total === 1 ? 'evento' : 'eventos'}`}
      aria-pressed={isSelected}
      className={cn(
        'flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg',
        'border px-2 py-3 transition-all duration-150 cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        isSelected
          ? 'border-accent bg-accent/8 ring-2 ring-accent shadow-1'
          : 'border-border bg-surface hover:bg-surface-muted hover:border-border',
        isToday && !isSelected && 'border-accent/40 bg-accent/4'
      )}
    >
      {/* Day abbreviation */}
      <span className="text-xs font-semibold uppercase tracking-wide text-text-soft">
        {DIAS_LABEL_CORTO[day.diaKey]}
      </span>

      {/* Day number */}
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
          isToday ? 'bg-accent text-white' : 'text-text'
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
                <span key={`p-${i}`} className="h-2 w-2 rounded-full bg-warning" />
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
  onEventClick
}: {
  day: DaySummary
  isToday: boolean
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
                  'flex min-h-[56px] w-full items-center gap-4 rounded-lg border border-border',
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
                  'flex min-h-[56px] w-full items-center gap-4 rounded-lg border border-border',
                  'bg-surface px-4 py-3 text-left transition-colors duration-150',
                  'hover:bg-surface-muted hover:border-accent/30 cursor-pointer',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
                )}
              >
                <span className="h-3 w-3 shrink-0 rounded-full bg-warning" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text">{pedido.numero}</span>
                    <span className="text-sm text-text-muted">· {pedido.cliente}</span>
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
          <p className="text-sm text-text-muted">Sin actividad programada para este día.</p>
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
  onNavigate
}: {
  clase: DayClase
  open: boolean
  onClose: () => void
  onNavigate: () => void
}) {
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
              {clase.estudiantes.map((est) => (
                <div
                  key={est.id}
                  className="flex items-center gap-3 rounded-md bg-surface-muted px-3 py-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent-strong">
                    {est.nombre
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <span className="text-sm text-text">{est.nombre}</span>
                  {est.esMenor && (
                    <Badge color="info" size="sm">
                      Menor
                    </Badge>
                  )}
                </div>
              ))}
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
  const TIPO_ENTREGA_LABEL: Record<string, string> = {
    estandar: 'Estándar',
    urgente: 'Urgente',
    sin_afan: 'Sin afán'
  }

  return (
    <Modal open={open} onClose={onClose} title={`Pedido ${pedido.numero}`} size="sm">
      <div className="space-y-5">
        {/* Client */}
        <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-widest text-text-soft">Cliente</p>
          <p className="mt-1 text-base font-semibold text-text">{pedido.cliente}</p>
          {pedido.clienteTelefono && (
            <p className="mt-0.5 text-sm text-text-muted">{pedido.clienteTelefono}</p>
          )}
        </div>

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
          <div className="rounded-lg border border-border px-4 py-3">
            <p className="text-xs text-text-soft">Entrega</p>
            <p className="mt-1 text-sm font-semibold text-text">
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

  const desde = toISO(weekStart)
  const hasta = toISO(addDays(weekStart, 6))

  const { data: pedidosRaw, loading: loadingPedidos } = useIpc<PedidoAlertaRow[]>(
    () => window.api.pedidos.porRangoFecha(desde, hasta),
    [desde, hasta]
  )

  const { data: clases, loading: loadingClases } = useIpc<Clase[]>(
    () => window.api.clases.listar(true),
    []
  )

  const { data: estudiantes } = useIpc<Estudiante[]>(() => window.api.estudiantes.listar(true), [])
  const { data: clientesData } = useIpc<Cliente[]>(
    () => window.api.clientes.listar({ soloActivos: false }),
    []
  )

  const pedidos = useMemo(() => normalizePedidoAlertas(pedidosRaw), [pedidosRaw])

  // Build lookup: clienteId → nombre
  const clienteMap = useMemo(() => {
    const map = new Map<number, Cliente>()
    if (clientesData) {
      for (const c of clientesData) map.set(c.id, c)
    }
    return map
  }, [clientesData])

  // Build lookup: claseId → list of students with names
  const estudiantesPorClase = useMemo(() => {
    const map = new Map<number, EstudianteInfo[]>()
    if (estudiantes) {
      for (const est of estudiantes) {
        if (est.claseId != null) {
          const list = map.get(est.claseId) ?? []
          const cli = clienteMap.get(est.clienteId)
          list.push({ id: est.id, nombre: cli?.nombre ?? 'Sin nombre', esMenor: est.esMenor })
          map.set(est.claseId, list)
        }
      }
    }
    return map
  }, [estudiantes, clienteMap])

  // Build DaySummary array for the 7 days
  const weekDays = useMemo((): DaySummary[] => {
    return DIAS_SEMANA_ORDEN.map((diaKey, i) => {
      const date = addDays(weekStart, i)
      const iso = toISO(date)
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
      for (const { pedido, cliente } of pedidos) {
        if (!pedido.fechaEntrega || pedido.fechaEntrega !== iso) continue
        const tipoKey = pedido.tipoTrabajo as TipoTrabajo | undefined
        const tipoLabel = tipoKey ? (TIPO_TRABAJO_LABEL[tipoKey] ?? '') : ''
        const dims = pedido.anchoCm && pedido.altoCm ? `${pedido.anchoCm}x${pedido.altoCm}` : ''
        const desc = [tipoLabel, dims].filter(Boolean).join(' ')

        events.push({
          tipo: 'pedido',
          id: pedido.id ?? 0,
          numero: pedido.numero ?? '?',
          cliente: cliente?.nombre ?? '',
          clienteTelefono: cliente?.telefono ?? '',
          estado: pedido.estado ?? '',
          tipoTrabajo: tipoLabel,
          descripcion: desc || pedido.descripcion || '',
          precioTotal: pedido.precioTotal ?? 0,
          anchoCm: pedido.anchoCm ?? 0,
          altoCm: pedido.altoCm ?? 0,
          tipoEntrega: pedido.tipoEntrega ?? 'estandar'
        })
      }

      return {
        date,
        iso,
        diaKey,
        events,
        claseCount: events.filter((e) => e.tipo === 'clase').length,
        pedidoCount: events.filter((e) => e.tipo === 'pedido').length
      }
    })
  }, [weekStart, clases, pedidos, estudiantesPorClase])

  const [popupEvent, setPopupEvent] = useState<DayEvent | null>(null)

  const selectedDay = weekDays.find((d) => d.iso === selectedISO) ?? weekDays[0]

  const totalPedidosSemana = pedidos.length
  const totalClasesSemana = clases ? clases.filter((c) => DIA_INDEX[c.diaSemana] != null).length : 0

  const loading = loadingPedidos || loadingClases

  const handleGoToday = useCallback(() => {
    const mondayOfToday = getMonday(new Date())
    setWeekStart(mondayOfToday)
    setSelectedISO(hoyISO())
  }, [])

  const handlePrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const newStart = addDays(prev, -7)
      // Select Monday of the new week
      setSelectedISO(toISO(newStart))
      return newStart
    })
  }, [])

  const handleNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const newStart = addDays(prev, 7)
      // Select Monday of the new week
      setSelectedISO(toISO(newStart))
      return newStart
    })
  }, [])

  return (
    <OperationalBoard
      eyebrow="Planificacion"
      title="Agenda semanal"
      subtitle="Entregas de pedidos y horarios de clases en la semana"
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
            {totalPedidosSemana} {totalPedidosSemana === 1 ? 'entrega' : 'entregas'}
          </span>
          <span className="flex items-center gap-1.5">
            <Palette size={16} className="text-info" />
            {totalClasesSemana} {totalClasesSemana === 1 ? 'clase' : 'clases'}
          </span>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          {/* Week overview row */}
          <div className="grid grid-cols-7 gap-2" role="listbox" aria-label="Dias de la semana">
            {weekDays.map((day) => (
              <WeekOverviewCell
                key={day.diaKey}
                day={day}
                isToday={day.iso === hoy}
                isSelected={day.iso === selectedISO}
                onSelect={() => setSelectedISO(day.iso)}
              />
            ))}
          </div>

          {/* Day detail panel */}
          <DayDetailPanel
            day={selectedDay}
            isToday={selectedDay.iso === hoy}
            onEventClick={(event) => setPopupEvent(event)}
          />
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
