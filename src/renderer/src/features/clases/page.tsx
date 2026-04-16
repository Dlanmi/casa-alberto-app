import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Palette,
  ShoppingBag,
  Clock,
  UserPlus,
  BookOpen,
  AlertCircle,
  Calendar,
  Edit2,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useIpcMutation } from '@renderer/hooks/use-ipc-mutation'
import { useToast } from '@renderer/contexts/toast-context'
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Modal } from '@renderer/components/ui/modal'
import { Input } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { Tabs } from '@renderer/components/ui/tabs'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { PaletteBrushIllustration } from '@renderer/components/illustrations'
import { PageLoader } from '@renderer/components/ui/spinner'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { PagoBar } from '@renderer/components/shared/pago-bar'
import { ClientePicker } from '@renderer/components/shared/cliente-picker'
import { WorkflowScreen, MetricCard, PageSection } from '@renderer/components/layout/page-frame'
import { iniciales, mesActualISO, hoyISO, formatCOP, formatFechaLarga } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import { METODO_PAGO_LABEL } from '@renderer/lib/constants'
import type {
  Clase,
  Estudiante,
  PagoClase,
  Cliente,
  MetodoPago,
  EstadoPagoClase,
  Asistencia,
  ResumenAsistencia,
  IpcResult
} from '@shared/types'
import { METODOS_PAGO, DIAS_SEMANA } from '@shared/types'

type StatusColor = 'success' | 'warning' | 'error'

const ESTADO_PAGO_LABEL: Record<EstadoPagoClase, string> = {
  pagado: 'Pagado',
  parcial: 'Parcial',
  pendiente: 'Pendiente'
}

const ESTADO_PAGO_COLOR: Record<EstadoPagoClase, StatusColor> = {
  pagado: 'success',
  parcial: 'warning',
  pendiente: 'error'
}

type ActiveModal =
  | 'pago'
  | 'kit'
  | 'estudiante'
  | 'clase'
  | 'detalleEstudiante'
  | 'editEstudiante'
  | null

function diaSemanaDeISO(iso: string): string {
  const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  return dias[new Date(iso + 'T12:00:00').getDay()]
}

export default function ClasesPage(): React.JSX.Element {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [activeTab, setActiveTab] = useState<string>('estudiantes')
  const [pagoEstudianteId, setPagoEstudianteId] = useState<string>('')
  const [selectedEstudiante, setSelectedEstudiante] = useState<number | null>(null)
  const [preselectedClaseId, setPreselectedClaseId] = useState<number | null>(null)
  const [asistenciaFecha, setAsistenciaFecha] = useState(hoyISO())
  const [attendance, setAttendance] = useState<Record<number, boolean>>({})
  const { showToast } = useToast()

  const mesActual = mesActualISO()

  const {
    data: clasesData,
    loading: loadingClases,
    error: errorClases,
    refetch: refetchClases
  } = useIpc<Clase[]>(() => window.api.clases.listar(true), [])

  const {
    data: estudiantes,
    loading: loadingEst,
    error: errorEst,
    refetch: refetchEst
  } = useIpc<Estudiante[]>(() => window.api.estudiantes.listar(true), [])

  const { data: clientes } = useIpc<Cliente[]>(
    () => window.api.clientes.listar({ soloActivos: false }),
    []
  )

  const {
    data: pagosMes,
    refetch: refetchPagos,
    error: errorPagos
  } = useIpc<PagoClase[]>(() => window.api.pagosClases.listarMes(mesActual), [mesActual])

  // BR-012 / Fase 2 §D — los precios de la mensualidad y el kit viven en
  // `configuracion`. No se pueden hardcodear en la UI porque el dueño los
  // ajusta desde el módulo de Configuración. Si el usuario todavía no corrió
  // el seed o el valor está en 0 usamos los valores base de Fase 2 como
  // fallback razonable.
  const { data: precioMensualCfg } = useIpc<number>(
    () => window.api.configuracion.getNumber('precio_clase_mensual', 110000),
    []
  )
  const { data: precioKitCfg } = useIpc<number>(
    () => window.api.configuracion.getNumber('precio_kit_dibujo', 15000),
    []
  )
  const precioMensual = precioMensualCfg && precioMensualCfg > 0 ? precioMensualCfg : 110000
  const precioKit = precioKitCfg && precioKitCfg > 0 ? precioKitCfg : 15000

  const clienteMap = useMemo(() => {
    const map = new Map<number, string>()
    clientes?.forEach((c) => map.set(c.id, c.nombre))
    return map
  }, [clientes])

  const claseMap = useMemo(() => {
    const map = new Map<number, Clase>()
    clasesData?.forEach((c) => map.set(c.id, c))
    return map
  }, [clasesData])

  const pagoMap = useMemo(() => {
    const map = new Map<number, PagoClase>()
    pagosMes?.forEach((p) => map.set(p.estudianteId, p))
    return map
  }, [pagosMes])

  const stats = useMemo(() => {
    const totalClases = clasesData?.length ?? 0
    const totalEstudiantes = estudiantes?.length ?? 0
    const pagosPendientes =
      estudiantes?.filter((est) => (pagoMap.get(est.id)?.estado ?? 'pendiente') !== 'pagado')
        .length ?? 0
    return { totalClases, totalEstudiantes, pagosPendientes }
  }, [clasesData, estudiantes, pagoMap])

  const clasesDelDia = useMemo(() => {
    const dia = diaSemanaDeISO(asistenciaFecha)
    return (clasesData ?? []).filter((c) => c.diaSemana === dia)
  }, [clasesData, asistenciaFecha])

  // Load existing attendance when date changes
  useEffect(() => {
    if (clasesDelDia.length === 0) return
    let cancelled = false

    async function loadAttendance(): Promise<void> {
      const newAttendance: Record<number, boolean> = {}
      for (const clase of clasesDelDia) {
        try {
          const res = (await window.api.asistencias.listar({
            claseId: clase.id,
            desde: asistenciaFecha,
            hasta: asistenciaFecha
          })) as IpcResult<Asistencia[]>
          if (!cancelled && res.ok) {
            res.data.forEach((a) => {
              newAttendance[a.estudianteId] = a.presente
            })
          }
        } catch {
          // silently ignore
        }
      }
      if (!cancelled) {
        setAttendance(newAttendance)
      }
    }

    loadAttendance()
    return () => {
      cancelled = true
    }
  }, [asistenciaFecha, clasesDelDia])

  const openPagoModal = useCallback((estudianteId?: number) => {
    setPagoEstudianteId(estudianteId ? String(estudianteId) : '')
    setActiveModal('pago')
  }, [])

  const closePagoModal = useCallback(() => {
    setActiveModal(null)
    setPagoEstudianteId('')
  }, [])

  const openDetalleEstudiante = useCallback((estudianteId: number) => {
    setSelectedEstudiante(estudianteId)
    setActiveModal('detalleEstudiante')
  }, [])

  async function guardarAsistencia(claseId: number): Promise<void> {
    const estudiantesClase = (estudiantes ?? []).filter((e) => e.claseId === claseId)
    const items = estudiantesClase.map((est) => ({
      estudianteId: est.id,
      presente: attendance[est.id] ?? true
    }))
    try {
      const res = (await window.api.asistencias.registrarGrupal(
        claseId,
        asistenciaFecha,
        items
      )) as IpcResult<unknown>
      if (res.ok) {
        showToast('success', 'Asistencia guardada correctamente')
      } else {
        showToast('error', res.error)
      }
    } catch {
      showToast('error', 'Error al guardar la asistencia')
    }
  }

  if (loadingClases || loadingEst) return <PageLoader />

  const ipcError = errorClases || errorEst || errorPagos

  return (
    <>
      <WorkflowScreen
        title="Clases"
        subtitle="Estudiantes, asistencia y pagos mensuales."
        primaryAction={{
          label: 'Nuevo estudiante',
          onClick: () => setActiveModal('estudiante'),
          icon: UserPlus
        }}
        secondaryActions={[
          {
            label: 'Nueva clase',
            onClick: () => setActiveModal('clase'),
            icon: BookOpen,
            variant: 'secondary'
          },
          {
            label: 'Vender kit',
            onClick: () => setActiveModal('kit'),
            icon: ShoppingBag,
            variant: 'outline'
          }
        ]}
        main={
          <>
            {ipcError && !clasesData && !estudiantes && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-warning/20 bg-warning-bg p-4 text-text">
                <AlertCircle size={20} className="text-warning shrink-0" />
                <div>
                  <p className="text-sm font-medium">Algo salio mal al cargar los datos</p>
                  <p className="text-xs text-text-muted">
                    Intenta cerrar y abrir la app. Si el problema sigue, revisa la configuracion.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard label="Clases" value={stats.totalClases} icon={BookOpen} />
              <MetricCard
                label="Estudiantes"
                value={stats.totalEstudiantes}
                icon={Palette}
                tone="info"
              />
              <MetricCard
                label="Pagos pendientes"
                value={stats.pagosPendientes}
                icon={AlertCircle}
                tone="warning"
              />
            </div>

            <Tabs
              tabs={[
                { key: 'estudiantes', label: 'Estudiantes', count: stats.totalEstudiantes },
                { key: 'asistencia', label: 'Asistencia' },
                { key: 'pagos', label: 'Pagos', count: stats.pagosPendientes }
              ]}
              active={activeTab}
              onChange={setActiveTab}
              idBase="clases-tabs"
            />

            {/* Tab: Estudiantes */}
            {activeTab === 'estudiantes' && (
              <PageSection title="Estudiantes">
                {!estudiantes || estudiantes.length === 0 ? (
                  <EmptyState
                    icon={Palette}
                    illustration={<PaletteBrushIllustration size={140} />}
                    title="Sin estudiantes registrados"
                    description="Registra a tus estudiantes de dibujo para llevar el control de pagos y asistencia."
                    actionLabel="Nuevo estudiante"
                    onAction={() => setActiveModal('estudiante')}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {estudiantes.map((est) => {
                      const nombre = clienteMap.get(est.clienteId) ?? 'Sin nombre'
                      const clase = est.claseId ? claseMap.get(est.claseId) : null
                      const pago = pagoMap.get(est.id)
                      const estadoPago: EstadoPagoClase = pago?.estado ?? 'pendiente'

                      return (
                        <Card
                          key={est.id}
                          padding="md"
                          className="cursor-pointer space-y-3 border-border bg-surface transition-shadow hover:shadow-2"
                          onClick={() => openDetalleEstudiante(est.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold',
                                'bg-accent/10 text-accent'
                              )}
                            >
                              {iniciales(nombre)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-text">{nombre}</p>
                              {clase && (
                                <p className="truncate text-xs capitalize text-text-muted">
                                  {clase.nombre} - {clase.diaSemana}
                                </p>
                              )}
                            </div>
                            {est.esMenor && <Badge color="info">Menor</Badge>}
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge color={ESTADO_PAGO_COLOR[estadoPago]}>
                              {ESTADO_PAGO_LABEL[estadoPago]}
                            </Badge>
                            {pago && (
                              <PrecioDisplay
                                value={pago.valorTotal}
                                size="sm"
                                className="text-text-muted"
                              />
                            )}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </PageSection>
            )}

            {/* Tab: Asistencia */}
            {activeTab === 'asistencia' && (
              <PageSection title="Asistencia">
                <div className="mb-4 max-w-xs">
                  <Input
                    type="date"
                    value={asistenciaFecha}
                    onChange={(e) => setAsistenciaFecha(e.target.value)}
                    label="Fecha"
                  />
                </div>

                {clasesDelDia.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title="Sin clases este dia"
                    description={`No hay clases programadas para el ${formatFechaLarga(asistenciaFecha)}. Cambia la fecha para buscar otro dia.`}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    {clasesDelDia.map((clase) => {
                      const estudiantesClase = (estudiantes ?? []).filter(
                        (e) => e.claseId === clase.id
                      )
                      return (
                        <Card key={clase.id} padding="md" className="border-border bg-surface">
                          <div className="mb-3 flex items-center gap-3">
                            <Clock size={18} className="text-accent shrink-0" />
                            <div>
                              <h3 className="text-sm font-semibold text-text">
                                {clase.nombre} — {clase.horaInicio} a {clase.horaFin}
                              </h3>
                              <p className="text-xs capitalize text-text-muted">
                                {clase.diaSemana}
                              </p>
                            </div>
                          </div>

                          {estudiantesClase.length === 0 ? (
                            <p className="py-2 text-sm text-text-muted">
                              No hay estudiantes asignados a esta clase.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {estudiantesClase.map((est) => {
                                const nombre = clienteMap.get(est.clienteId) ?? 'Sin nombre'
                                const checked = attendance[est.id] ?? true
                                return (
                                  <label
                                    key={est.id}
                                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-muted"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        setAttendance((prev) => ({
                                          ...prev,
                                          [est.id]: e.target.checked
                                        }))
                                      }
                                      className="h-5 w-5 cursor-pointer rounded border-border text-accent focus:ring-accent"
                                    />
                                    <span className="flex-1 text-sm text-text">{nombre}</span>
                                    {checked ? (
                                      <CheckCircle2 size={16} className="text-success" />
                                    ) : (
                                      <XCircle size={16} className="text-error" />
                                    )}
                                  </label>
                                )
                              })}
                            </div>
                          )}

                          {estudiantesClase.length > 0 && (
                            <div className="mt-3 flex justify-end border-t border-border pt-3">
                              <Button size="sm" onClick={() => guardarAsistencia(clase.id)}>
                                Guardar asistencia
                              </Button>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                )}
              </PageSection>
            )}

            {/* Tab: Pagos */}
            {activeTab === 'pagos' && (
              <PageSection title={`Pagos ${mesActual}`}>
                {!estudiantes || estudiantes.length === 0 ? (
                  <EmptyState
                    icon={Palette}
                    title="Sin estudiantes registrados"
                    description="Registra estudiantes para controlar sus pagos mensuales."
                    actionLabel="Nuevo estudiante"
                    onAction={() => setActiveModal('estudiante')}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {estudiantes.map((est) => {
                      const nombre = clienteMap.get(est.clienteId) ?? 'Sin nombre'
                      const clase = est.claseId ? claseMap.get(est.claseId) : null
                      const pago = pagoMap.get(est.id)
                      const estadoPago: EstadoPagoClase = pago?.estado ?? 'pendiente'
                      // Usa el valorTotal real del pago si existe, si no el
                      // precio configurado. Esto mantiene correcta la barra
                      // aunque el dueño cambie la tarifa a mitad de mes.
                      const valorMensual = pago?.valorTotal ?? precioMensual
                      const totalPagado = pago?.totalPagado ?? 0

                      return (
                        <Card
                          key={est.id}
                          padding="md"
                          className="space-y-3 border-border bg-surface"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold',
                                'bg-accent/10 text-accent'
                              )}
                            >
                              {iniciales(nombre)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-text">{nombre}</p>
                              {clase && (
                                <p className="truncate text-xs capitalize text-text-muted">
                                  {clase.nombre} - {clase.diaSemana}
                                </p>
                              )}
                            </div>
                          </div>
                          <PagoBar total={valorMensual} pagado={totalPagado} showLabels />
                          <div className="flex items-center justify-between">
                            <Badge color={ESTADO_PAGO_COLOR[estadoPago]}>
                              {ESTADO_PAGO_LABEL[estadoPago]}
                            </Badge>
                            <div className="flex items-center gap-2">
                              {pago && (
                                <PrecioDisplay
                                  value={pago.valorTotal}
                                  size="sm"
                                  className="text-text-muted"
                                />
                              )}
                              {estadoPago !== 'pagado' && (
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => openPagoModal(est.id)}
                                >
                                  Cobrar
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </PageSection>
            )}
          </>
        }
        aside={
          <PageSection title="Horarios">
            {clasesData && clasesData.length > 0 ? (
              <div className="flex flex-col gap-3">
                {clasesData.map((c) => {
                  const estudiantesClase = (estudiantes ?? []).filter((e) => e.claseId === c.id)
                  return (
                    <Card key={c.id} padding="sm" className="border-border bg-surface">
                      <div className="flex items-center gap-3">
                        <Clock size={16} className="text-text-soft shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">{c.nombre}</p>
                          <p className="text-xs capitalize text-text-muted">
                            {c.diaSemana} {c.horaInicio} - {c.horaFin}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-text-soft tabular-nums">
                            {estudiantesClase.length}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreselectedClaseId(c.id)
                              setActiveModal('estudiante')
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-accent-strong hover:bg-accent/10 cursor-pointer transition-colors"
                            aria-label={`Inscribir estudiante a ${c.nombre}`}
                            title="Inscribir estudiante"
                          >
                            <UserPlus size={16} />
                          </button>
                        </div>
                      </div>
                      {estudiantesClase.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border space-y-1">
                          {estudiantesClase.map((est) => (
                            <p key={est.id} className="text-xs text-text-muted truncate pl-7">
                              {clienteMap.get(est.clienteId) ?? 'Sin nombre'}
                              {est.esMenor && (
                                <span className="ml-1.5 text-info text-[10px] font-medium">
                                  Menor
                                </span>
                              )}
                            </p>
                          ))}
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="Sin horarios"
                description="Crea una clase para empezar a asignar estudiantes."
                actionLabel="Nueva clase"
                onAction={() => setActiveModal('clase')}
              />
            )}
          </PageSection>
        }
      />

      {/* Pago modal */}
      {activeModal === 'pago' && (
        <PagoClaseModal
          estudiantes={estudiantes ?? []}
          clienteMap={clienteMap}
          initialEstudianteId={pagoEstudianteId}
          precioMensual={precioMensual}
          onClose={closePagoModal}
          onSuccess={() => {
            closePagoModal()
            refetchPagos()
            showToast('success', 'Pago de clase registrado')
          }}
        />
      )}

      {/* Kit modal */}
      {activeModal === 'kit' && (
        <VentaKitModal
          estudiantes={estudiantes ?? []}
          clienteMap={clienteMap}
          precioKit={precioKit}
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            setActiveModal(null)
            showToast('success', 'Kit vendido correctamente')
          }}
        />
      )}

      {/* Nuevo estudiante modal */}
      {activeModal === 'estudiante' && (
        <NuevoEstudianteModal
          clases={clasesData ?? []}
          initialClaseId={preselectedClaseId}
          onClose={() => {
            setActiveModal(null)
            setPreselectedClaseId(null)
          }}
          onSuccess={() => {
            setActiveModal(null)
            setPreselectedClaseId(null)
            refetchEst()
            showToast('success', 'Estudiante registrado')
          }}
        />
      )}

      {/* Nueva clase modal */}
      {activeModal === 'clase' && (
        <NuevaClaseModal
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            setActiveModal(null)
            refetchClases()
            showToast('success', 'Clase creada correctamente')
          }}
        />
      )}

      {/* Detalle estudiante modal */}
      {activeModal === 'detalleEstudiante' && selectedEstudiante && (
        <DetalleEstudianteModal
          estudianteId={selectedEstudiante}
          estudiantes={estudiantes ?? []}
          clienteMap={clienteMap}
          claseMap={claseMap}
          pagoMap={pagoMap}
          mes={mesActual}
          onClose={() => {
            setActiveModal(null)
            setSelectedEstudiante(null)
          }}
          onEdit={() => {
            setActiveModal('editEstudiante')
          }}
        />
      )}

      {/* Edit estudiante modal */}
      {activeModal === 'editEstudiante' && selectedEstudiante && (
        <EditEstudianteModal
          estudianteId={selectedEstudiante}
          estudiantes={estudiantes ?? []}
          clases={clasesData ?? []}
          onClose={() => {
            setActiveModal(null)
            setSelectedEstudiante(null)
          }}
          onSuccess={() => {
            setActiveModal(null)
            setSelectedEstudiante(null)
            refetchEst()
            showToast('success', 'Estudiante actualizado')
          }}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Detalle Estudiante Modal                                           */
/* ------------------------------------------------------------------ */

function DetalleEstudianteModal({
  estudianteId,
  estudiantes,
  clienteMap,
  claseMap,
  pagoMap,
  mes,
  onClose,
  onEdit
}: {
  estudianteId: number
  estudiantes: Estudiante[]
  clienteMap: Map<number, string>
  claseMap: Map<number, Clase>
  pagoMap: Map<number, PagoClase>
  mes: string
  onClose: () => void
  onEdit: () => void
}): React.JSX.Element {
  const est = estudiantes.find((e) => e.id === estudianteId)
  const nombre = est ? (clienteMap.get(est.clienteId) ?? 'Sin nombre') : 'Sin nombre'
  const clase = est?.claseId ? claseMap.get(est.claseId) : null
  const pago = est ? pagoMap.get(est.id) : null
  const estadoPago: EstadoPagoClase = pago?.estado ?? 'pendiente'

  const [resumen, setResumen] = useState<ResumenAsistencia | null>(null)
  const [recentAttendance, setRecentAttendance] = useState<Asistencia[]>([])
  const [loadingResumen, setLoadingResumen] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      setLoadingResumen(true)
      try {
        const resResumen = (await window.api.asistencias.resumenMes(
          estudianteId,
          mes
        )) as IpcResult<ResumenAsistencia>
        if (!cancelled && resResumen.ok) {
          setResumen(resResumen.data)
        }

        const resListar = (await window.api.asistencias.listar({
          estudianteId,
          limit: 10
        })) as IpcResult<Asistencia[]>
        if (!cancelled && resListar.ok) {
          setRecentAttendance(resListar.data)
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoadingResumen(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [estudianteId, mes])

  return (
    <Modal open onClose={onClose} title="Detalle del estudiante" size="md">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold',
              'bg-accent/10 text-accent'
            )}
          >
            {iniciales(nombre)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-text">{nombre}</p>
            {clase && (
              <p className="text-sm capitalize text-text-muted">
                {clase.nombre} - {clase.diaSemana} {clase.horaInicio}
              </p>
            )}
            {!clase && <p className="text-sm text-text-muted">Sin clase asignada</p>}
          </div>
          <div className="flex items-center gap-2">
            {est?.esMenor && <Badge color="info">Menor</Badge>}
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <Edit2 size={14} className="mr-1" />
              Editar
            </Button>
          </div>
        </div>

        {/* Info row */}
        {est && (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface-muted p-3">
            <div>
              <p className="text-xs text-text-soft">Fecha de ingreso</p>
              <p className="text-sm font-medium text-text">{formatFechaLarga(est.fechaIngreso)}</p>
            </div>
            <div>
              <p className="text-xs text-text-soft">Estado de pago ({mes})</p>
              <Badge color={ESTADO_PAGO_COLOR[estadoPago]}>{ESTADO_PAGO_LABEL[estadoPago]}</Badge>
            </div>
          </div>
        )}

        {/* Attendance summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-text">Asistencia del mes</h4>
          {loadingResumen ? (
            <p className="text-sm text-text-muted">Cargando...</p>
          ) : resumen ? (
            <>
              <PagoBar total={resumen.total} pagado={resumen.presentes} showLabels={false} />
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">
                  Presentes: {resumen.presentes} de {resumen.total}
                </span>
                <span className="font-medium text-text-soft">
                  {resumen.ausentes} ausencia{resumen.ausentes !== 1 ? 's' : ''}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">Sin registros de asistencia este mes.</p>
          )}
        </div>

        {/* Recent attendance */}
        {recentAttendance.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-text">Asistencia reciente</h4>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {recentAttendance.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md px-2 py-1.5"
                >
                  <span className="text-xs text-text-muted">{formatFechaLarga(a.fecha)}</span>
                  {a.presente ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 size={14} />
                      Presente
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-error">
                      <XCircle size={14} />
                      Ausente
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment status */}
        {pago && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-text">Pago del mes</h4>
            <PagoBar total={pago.valorTotal} pagado={pago.totalPagado ?? 0} showLabels />
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Edit Estudiante Modal                                              */
/* ------------------------------------------------------------------ */

function EditEstudianteModal({
  estudianteId,
  estudiantes,
  clases,
  onClose,
  onSuccess
}: {
  estudianteId: number
  estudiantes: Estudiante[]
  clases: Clase[]
  onClose: () => void
  onSuccess: () => void
}): React.JSX.Element {
  const est = estudiantes.find((e) => e.id === estudianteId)
  const [claseId, setClaseId] = useState(est?.claseId ? String(est.claseId) : '')

  const { execute, loading } = useIpcMutation(
    useCallback(
      (id: number, data: { claseId: number | null }) => window.api.estudiantes.actualizar(id, data),
      []
    )
  )

  const claseOptions = clases.map((c) => ({
    value: String(c.id),
    label: `${c.nombre} - ${c.diaSemana} ${c.horaInicio}`
  }))

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    try {
      await execute(estudianteId, {
        claseId: claseId ? parseInt(claseId) : null
      })
      onSuccess()
    } catch {
      // handled by hook
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar estudiante" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Clase asignada"
          options={[{ value: '', label: 'Sin asignar' }, ...claseOptions]}
          value={claseId}
          onChange={(e) => setClaseId(e.target.value)}
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Pago Clase Modal                                                   */
/* ------------------------------------------------------------------ */

function PagoClaseModal({
  estudiantes,
  clienteMap,
  initialEstudianteId = '',
  precioMensual,
  onClose,
  onSuccess
}: {
  estudiantes: Estudiante[]
  clienteMap: Map<number, string>
  initialEstudianteId?: string
  precioMensual: number
  onClose: () => void
  onSuccess: () => void
}): React.JSX.Element {
  const [form, setForm] = useState({
    estudianteId: initialEstudianteId,
    mes: mesActualISO(),
    monto: String(precioMensual),
    metodoPago: 'efectivo' as MetodoPago
  })

  const { execute, loading } = useIpcMutation(
    useCallback(
      (data: {
        estudianteId: number
        mes: string
        monto: number
        metodoPago: MetodoPago
        fecha: string
      }) => window.api.pagosClases.registrar(data),
      []
    )
  )

  const estudianteOptions = estudiantes.map((e) => ({
    value: String(e.id),
    label: clienteMap.get(e.clienteId) ?? `Estudiante ${e.id}`
  }))

  const metodoPagoOptions = METODOS_PAGO.map((m) => ({
    value: m,
    label: METODO_PAGO_LABEL[m]
  }))

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!form.estudianteId) return
    const monto = parseFloat(form.monto)
    if (isNaN(monto) || monto <= 0) return
    try {
      await execute({
        estudianteId: parseInt(form.estudianteId),
        mes: form.mes,
        monto,
        metodoPago: form.metodoPago,
        fecha: hoyISO()
      })
      onSuccess()
    } catch {
      // handled by hook
    }
  }

  return (
    <Modal open onClose={onClose} title="Registrar pago de clase" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Estudiante"
          options={estudianteOptions}
          value={form.estudianteId}
          onChange={(e) => setForm((p) => ({ ...p, estudianteId: e.target.value }))}
          placeholder="Seleccionar estudiante"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Mes"
            type="month"
            value={form.mes}
            onChange={(e) => setForm((p) => ({ ...p, mes: e.target.value }))}
          />
          <Input
            label="Monto"
            type="number"
            value={form.monto}
            onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
            hint={formatCOP(precioMensual)}
          />
        </div>
        <Select
          label="Metodo de pago"
          options={metodoPagoOptions}
          value={form.metodoPago}
          onChange={(e) => setForm((p) => ({ ...p, metodoPago: e.target.value as MetodoPago }))}
        />
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar pago'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Venta Kit Modal                                                    */
/* ------------------------------------------------------------------ */

function VentaKitModal({
  estudiantes,
  clienteMap,
  precioKit,
  onClose,
  onSuccess
}: {
  estudiantes: Estudiante[]
  clienteMap: Map<number, string>
  precioKit: number
  onClose: () => void
  onSuccess: () => void
}): React.JSX.Element {
  const [estudianteId, setEstudianteId] = useState('')

  const { execute, loading } = useIpcMutation(
    useCallback(
      (data: { estudianteId: number | null; fecha: string; precio: number }) =>
        window.api.kits.vender(data),
      []
    )
  )

  const estudianteOptions = estudiantes.map((e) => ({
    value: String(e.id),
    label: clienteMap.get(e.clienteId) ?? `Estudiante ${e.id}`
  }))

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    // venderKit exige estudiante o cliente: aquí sólo permitimos estudiante,
    // así que lo validamos antes de disparar el mutator.
    if (!estudianteId) return
    try {
      await execute({
        estudianteId: parseInt(estudianteId),
        fecha: hoyISO(),
        precio: precioKit
      })
      onSuccess()
    } catch {
      // handled by hook
    }
  }

  return (
    <Modal open onClose={onClose} title="Vender kit de dibujo" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Estudiante"
          options={[{ value: '', label: 'Selecciona un estudiante' }, ...estudianteOptions]}
          value={estudianteId}
          onChange={(e) => setEstudianteId(e.target.value)}
        />
        <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
          <p className="mb-1 text-sm text-text-muted">Precio del kit</p>
          <PrecioDisplay value={precioKit} size="lg" className="text-text" />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading || !estudianteId}>
            {loading ? 'Vendiendo...' : 'Vender kit'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Nuevo Estudiante Modal                                             */
/* ------------------------------------------------------------------ */

function NuevoEstudianteModal({
  clases,
  initialClaseId,
  onClose,
  onSuccess
}: {
  clases: Clase[]
  initialClaseId?: number | null
  onClose: () => void
  onSuccess: () => void
}): React.JSX.Element {
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [form, setForm] = useState({
    claseId: initialClaseId ? String(initialClaseId) : '',
    fechaIngreso: hoyISO(),
    esMenor: false
  })

  const { execute, loading } = useIpcMutation(
    useCallback(
      (data: {
        clienteId: number
        claseId: number | null
        fechaIngreso: string
        esMenor: boolean
      }) => window.api.estudiantes.crear(data),
      []
    )
  )

  const claseOptions = clases.map((c) => ({
    value: String(c.id),
    label: `${c.nombre} - ${c.diaSemana} ${c.horaInicio}`
  }))

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!selectedCliente) return
    try {
      await execute({
        clienteId: selectedCliente.id,
        claseId: form.claseId ? parseInt(form.claseId) : null,
        fechaIngreso: form.fechaIngreso,
        esMenor: form.esMenor
      })
      onSuccess()
    } catch {
      // handled by hook
    }
  }

  return (
    <Modal open onClose={onClose} title="Nuevo estudiante" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ClientePicker label="Cliente" value={selectedCliente} onChange={setSelectedCliente} />
        <Select
          label="Clase"
          options={[{ value: '', label: 'Sin asignar' }, ...claseOptions]}
          value={form.claseId}
          onChange={(e) => setForm((p) => ({ ...p, claseId: e.target.value }))}
        />
        <Input
          label="Fecha de ingreso"
          type="date"
          value={form.fechaIngreso}
          onChange={(e) => setForm((p) => ({ ...p, fechaIngreso: e.target.value }))}
        />
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.esMenor}
            onChange={(e) => setForm((p) => ({ ...p, esMenor: e.target.checked }))}
            className="h-5 w-5 cursor-pointer rounded border-border text-accent focus:ring-accent"
          />
          <span className="text-sm font-medium text-text">Es menor de edad</span>
        </label>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading || !selectedCliente}>
            {loading ? 'Registrando...' : 'Registrar estudiante'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Nueva Clase Modal                                                  */
/* ------------------------------------------------------------------ */

const DIA_LABEL: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miercoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sabado'
}

const DIA_OPTIONS = DIAS_SEMANA.map((d) => ({
  value: d,
  label: DIA_LABEL[d] ?? d
}))

function NuevaClaseModal({
  onClose,
  onSuccess
}: {
  onClose: () => void
  onSuccess: () => void
}): React.JSX.Element {
  const [form, setForm] = useState({
    nombre: '',
    diaSemana: 'lunes' as string,
    horaInicio: '09:00',
    horaFin: '11:00'
  })

  const { execute, loading } = useIpcMutation(
    useCallback(
      (data: { nombre: string; diaSemana: string; horaInicio: string; horaFin: string }) =>
        window.api.clases.crear(data),
      []
    )
  )

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!form.nombre.trim()) return
    try {
      await execute({
        nombre: form.nombre.trim(),
        diaSemana: form.diaSemana,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin
      })
      onSuccess()
    } catch {
      // handled by hook
    }
  }

  return (
    <Modal open onClose={onClose} title="Nueva clase" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre"
          value={form.nombre}
          onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
          placeholder="Ej: Dibujo basico"
          required
        />
        <Select
          label="Dia de la semana"
          options={DIA_OPTIONS}
          value={form.diaSemana}
          onChange={(e) => setForm((p) => ({ ...p, diaSemana: e.target.value }))}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Hora inicio"
            type="time"
            value={form.horaInicio}
            onChange={(e) => setForm((p) => ({ ...p, horaInicio: e.target.value }))}
          />
          <Input
            label="Hora fin"
            type="time"
            value={form.horaFin}
            onChange={(e) => setForm((p) => ({ ...p, horaFin: e.target.value }))}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading || !form.nombre.trim()}>
            {loading ? 'Creando...' : 'Crear clase'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
