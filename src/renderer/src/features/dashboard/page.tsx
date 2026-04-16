import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calculator,
  ClipboardList,
  ArrowUpFromLine,
  Clock,
  CircleDollarSign,
  CalendarClock,
  TrendingUp,
  Truck
} from 'lucide-react'
import { OperationalBoard, PageSection } from '@renderer/components/layout/page-frame'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { Badge } from '@renderer/components/ui/badge'
import { PageLoader } from '@renderer/components/ui/spinner'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { useIpc } from '@renderer/hooks/use-ipc'
import { mesActualISO, hoyISO, formatCOP } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import { normalizePedidoAlertas, type PedidoAlertaRow } from '@renderer/lib/pedidos-alertas'
import { UrgencyMatrix } from './urgency-matrix'
import { BarChartMini } from '@renderer/components/charts/bar-chart-mini'
import { WorkshopIllustration } from '@renderer/components/illustrations'
import type { Pedido, Proveedor } from '@shared/types'

type ResumenMensual = {
  ingresos: number
  gastos: number
  balance: number
  porCategoria: { categoria: string; tipo: string; total: number }[]
}

type MovimientoHoy = {
  tipo: 'ingreso' | 'gasto'
  monto: number
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export default function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate()
  // `mes` y `hoy` como state para que las queries se refetcheen automáticamente
  // cuando el día cambia (medianoche). Antes se calculaban en cada render pero
  // como no eran state, los useIpc no detectaban el cambio y el dashboard
  // seguía mostrando el mes/día anterior si la app quedaba abierta.
  const [mes, setMes] = useState(mesActualISO())
  const [hoy, setHoy] = useState(hoyISO())

  useEffect(() => {
    const interval = setInterval(() => {
      const nuevoMes = mesActualISO()
      const nuevoHoy = hoyISO()
      setMes((prev) => (prev === nuevoMes ? prev : nuevoMes))
      setHoy((prev) => (prev === nuevoHoy ? prev : nuevoHoy))
    }, 60_000) // chequeo cada minuto
    return () => clearInterval(interval)
  }, [])

  const { data: pedidos, loading: loadingPedidos } = useIpc<Pedido[]>(
    () => window.api.pedidos.listar({}),
    []
  )
  const { data: atrasados } = useIpc<PedidoAlertaRow[]>(
    () => window.api.pedidos.alertas.atrasados(),
    []
  )
  const { data: proximos } = useIpc<PedidoAlertaRow[]>(
    () => window.api.pedidos.alertas.entregaProxima(2),
    []
  )
  const { data: sinAbono } = useIpc<PedidoAlertaRow[]>(
    () => window.api.pedidos.alertas.sinAbono(),
    []
  )
  const { data: resumenMensual, loading: loadingResumen } = useIpc<ResumenMensual>(
    () => window.api.finanzas.resumenMensual(mes),
    [mes]
  )
  const { data: movimientosHoy } = useIpc<MovimientoHoy[]>(
    () => window.api.finanzas.listarMovimientos({ desde: hoy, hasta: hoy }),
    [hoy]
  )
  const { data: proveedores } = useIpc<Proveedor[]>(
    () => window.api.proveedores.listar({ soloActivos: true }),
    []
  )

  if (loadingPedidos || loadingResumen) return <PageLoader />

  const safePedidos = pedidos ?? []
  const safeAtrasados = normalizePedidoAlertas(atrasados)
  const safeProximos = normalizePedidoAlertas(proximos)
  const safeSinAbono = normalizePedidoAlertas(sinAbono)

  const ingresosHoy =
    movimientosHoy
      ?.filter((movimiento) => movimiento.tipo === 'ingreso')
      .reduce((sum, item) => sum + item.monto, 0) ?? 0
  const gastosHoy =
    movimientosHoy
      ?.filter((movimiento) => movimiento.tipo === 'gasto')
      .reduce((sum, item) => sum + item.monto, 0) ?? 0
  const balanceHoy = ingresosHoy - gastosHoy

  const pedidosActivos = safePedidos.filter((pedido) =>
    ['confirmado', 'en_proceso', 'listo'].includes(pedido.estado)
  ).length

  const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const hoyDia = diasSemana[new Date().getDay()] ?? ''
  const proveedoresHoy = (proveedores ?? []).filter((proveedor) =>
    normalizeText(proveedor.diasPedido).includes(normalizeText(hoyDia))
  )

  const totalAlertas =
    safeAtrasados.length + safeSinAbono.length + safeProximos.length + proveedoresHoy.length

  const goPedidos = (focus?: string): void => {
    navigate(focus ? `/pedidos?focus=${focus}` : '/pedidos')
  }

  const goFacturas = (focus?: string): void => {
    navigate(focus ? `/facturas?focus=${focus}` : '/facturas')
  }

  const goProveedores = (focus?: string): void => {
    navigate(focus ? `/proveedores?focus=${focus}` : '/proveedores')
  }

  const goFinanzas = (focus?: string): void => {
    navigate(focus ? `/finanzas?focus=${focus}` : '/finanzas')
  }

  const todayLabel = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

  return (
    <OperationalBoard
      title="Tablero operativo del día"
      subtitle="Empieza por lo urgente, pasa a la siguiente acción útil y mantén visible el pulso financiero del taller."
      guidance={{
        tone: totalAlertas > 0 ? 'warning' : 'success',
        title: totalAlertas > 0 ? 'Empieza por lo urgente' : 'Todo está bajo control',
        message:
          totalAlertas > 0
            ? 'Usa las prioridades para entrar ya filtrado a cobros, entregas y seguimientos sensibles.'
            : 'No hay alertas críticas. Puedes concentrarte en nuevas ventas, facturación o pedidos del día.'
      }}
      primaryAction={{
        label: 'Nueva cotización',
        onClick: () => navigate('/cotizador'),
        icon: Calculator
      }}
      secondaryActions={[
        { label: 'Pedidos', onClick: () => goPedidos('requiere_accion'), icon: ClipboardList },
        {
          label: 'Cobros',
          onClick: () => goFacturas('pendientes'),
          icon: CircleDollarSign,
          variant: 'secondary'
        }
      ]}
    >
      {/* AGENT_UX: Acciones rápidas prominentes. Buttons grandes (48px alto)
          con icono + texto para que el dueño de 60 años pueda escanear y
          actuar sin leer. Nueva cotización vive en el header (primaryAction)
          para no duplicar el mismo CTA dos veces en la pantalla. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Button size="lg" variant="outline" onClick={() => goPedidos('requiere_accion')}>
          <ClipboardList size={18} />
          Gestionar pedidos
        </Button>
        <Button size="lg" variant="outline" onClick={() => goFacturas('pendientes')}>
          <CircleDollarSign size={18} />
          Registrar cobro
        </Button>
        <Button size="lg" variant="outline" onClick={() => goFinanzas('gastos')}>
          <ArrowUpFromLine size={18} />
          Registrar gasto
        </Button>
      </div>

      {safePedidos.length === 0 && (
        <GuidanceHint
          tone="accent"
          title="Bienvenido a Casa Alberto"
          message="Empieza creando tu primera cotización para generar un pedido."
          actionLabel="Crear cotización"
          onAction={() => navigate('/cotizador')}
        />
      )}

      <PageSection
        title="Prioridades"
        description="Las alertas de hoy ya te llevan a la vista más útil para actuar."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            {/* AGENT_UX + AGENT_BIZ: matriz 2x2 de urgencia. Datos vienen del
                hook useMatrizUrgencia (BR-001) directamente desde el backend. */}
            <UrgencyMatrix />
          </div>

          <div className="space-y-4 lg:col-span-2">
            {totalAlertas === 0 ? (
              <Card padding="md" className="flex flex-col items-center py-10 text-center">
                <div className="mb-4">
                  <WorkshopIllustration size={120} />
                </div>
                <p className="mb-2 text-base font-semibold text-text">Todo en orden</p>
                <p className="max-w-xs text-sm text-text-muted">
                  No hay alertas pendientes. Puedes dedicar este bloque a nuevas ventas o
                  seguimiento comercial.
                </p>
              </Card>
            ) : (
              <Card padding="md">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-soft">
                      Bandeja de alertas
                    </p>
                    <h3 className="text-base font-semibold text-text">
                      {totalAlertas} {totalAlertas === 1 ? 'cosa' : 'cosas'} por revisar
                    </h3>
                  </div>
                  <Badge color="warning" size="sm">
                    Hoy
                  </Badge>
                </div>
                <div className="space-y-2">
                  {safeAtrasados.length > 0 && (
                    <button
                      onClick={() => goPedidos('atrasados')}
                      className="flex w-full items-center gap-3 rounded-lg border-l-[3px] border-error bg-surface px-4 py-4 shadow-1 cursor-pointer transition-colors hover:bg-error-bg/40"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error-bg">
                        <Clock size={16} className="text-error-strong" />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-semibold text-text">
                          {safeAtrasados.length} pedido{safeAtrasados.length > 1 ? 's' : ''}{' '}
                          atrasado{safeAtrasados.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-error-strong">Resolver &gt;</span>
                    </button>
                  )}

                  {safeSinAbono.length > 0 && (
                    <button
                      onClick={() => goFacturas('pendientes')}
                      className="flex w-full items-center gap-3 rounded-lg border-l-[3px] border-warning bg-surface px-4 py-4 shadow-1 cursor-pointer transition-colors hover:bg-warning-bg/40"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-bg">
                        <CircleDollarSign size={16} className="text-warning-strong" />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-semibold text-text">
                          {safeSinAbono.length} pedido{safeSinAbono.length > 1 ? 's' : ''} sin
                          cobrar
                        </p>
                      </div>
                      <span className="text-sm font-medium text-warning-strong">Cobrar &gt;</span>
                    </button>
                  )}

                  {safeProximos.length > 0 && (
                    <button
                      onClick={() => goPedidos('proximos')}
                      className="flex w-full items-center gap-3 rounded-lg border-l-[3px] border-info bg-surface px-4 py-4 shadow-1 cursor-pointer transition-colors hover:bg-info-bg/40"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info-bg">
                        <CalendarClock size={16} className="text-info-strong" />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm font-semibold text-text">
                          {safeProximos.length} entrega{safeProximos.length > 1 ? 's' : ''} próxima
                          {safeProximos.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-info-strong">Ver &gt;</span>
                    </button>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </PageSection>

      <PageSection
        title="Estado del día"
        description="Balance financiero, agenda de proveedores y señales para el siguiente turno."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card padding="md" className="lg:col-span-2">
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp size={16} className="text-accent-strong" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-text-soft">
                Finanzas del día
              </span>
            </div>
            <p className="mb-5 text-xs text-text-muted">{todayLabel}</p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">Ingresos</span>
                <span className="text-sm font-semibold tabular-nums text-success-strong">
                  {formatCOP(ingresosHoy)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">Gastos</span>
                <span className="text-sm font-semibold tabular-nums text-error-strong">
                  {formatCOP(gastosHoy)}
                </span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Balance del día</span>
                  <span
                    className={cn(
                      'text-xl font-bold tabular-nums',
                      balanceHoy >= 0 ? 'text-text' : 'text-error-strong'
                    )}
                  >
                    {formatCOP(Math.abs(balanceHoy))}
                  </span>
                </div>
              </div>
            </div>

            {resumenMensual && (
              <div className="mt-4 rounded-md border border-border bg-surface-muted px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-widest text-text-soft">
                  Balance del mes
                </p>
                <div className="mt-2">
                  <BarChartMini
                    ingresos={resumenMensual.ingresos}
                    gastos={resumenMensual.gastos}
                    height={120}
                  />
                </div>
                <p className="mt-1 text-center text-sm text-text">
                  {resumenMensual.balance >= 0 ? 'Vas positivo' : 'Vas por debajo'} con{' '}
                  <span className="font-semibold tabular-nums">
                    {formatCOP(resumenMensual.balance)}
                  </span>
                </p>
              </div>
            )}

            <button
              onClick={() => goFinanzas('balance')}
              className="mt-4 block cursor-pointer text-sm text-accent-strong hover:text-accent"
            >
              Ver resumen del mes &gt;
            </button>
          </Card>

          <Card padding="md" className="lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
                  Estado del taller
                </p>
                <p className="mt-1 text-sm text-text-muted">
                  Alertas activas: {totalAlertas}. Pedidos con seguimiento hoy: {pedidosActivos}.
                </p>
              </div>
              {proveedoresHoy.length > 0 && (
                <Badge color="info" size="sm">
                  {proveedoresHoy.length} proveedor{proveedoresHoy.length > 1 ? 'es' : ''} para
                  pedir
                </Badge>
              )}
            </div>

            <div className="space-y-3">
              {proveedoresHoy.length > 0 ? (
                proveedoresHoy.map((proveedor) => (
                  <div
                    key={`proveedor-${proveedor.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface-muted px-4 py-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                      <Truck size={16} className="text-accent-strong" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text">
                        Hoy toca pedido con {proveedor.nombre}
                      </p>
                      <p className="truncate text-xs text-text-muted">
                        {proveedor.telefono ?? 'Sin teléfono registrado'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => goProveedores('pedido')}>
                      Abrir &gt;
                    </Button>
                  </div>
                ))
              ) : (
                <GuidanceHint
                  tone="success"
                  title="Sin llamados a proveedor para hoy"
                  message="No aparece ningún proveedor programado para pedido en la agenda actual."
                />
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <Card padding="md" className="space-y-2 bg-surface-muted">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
                    Cobros pendientes
                  </p>
                  <p className="text-2xl font-semibold text-text">{safeSinAbono.length}</p>
                  <button
                    type="button"
                    onClick={() => goFacturas('pendientes')}
                    className="text-left text-sm font-medium text-accent-strong hover:text-accent"
                  >
                    Abrir facturas pendientes &gt;
                  </button>
                </Card>
                <Card padding="md" className="space-y-2 bg-surface-muted">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
                    Entregas cercanas
                  </p>
                  <p className="text-2xl font-semibold text-text">{safeProximos.length}</p>
                  <button
                    type="button"
                    onClick={() => goPedidos('proximos')}
                    className="text-left text-sm font-medium text-accent-strong hover:text-accent"
                  >
                    Ver pedidos próximos &gt;
                  </button>
                </Card>
                <Card padding="md" className="space-y-2 bg-surface-muted">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
                    Pedidos atrasados
                  </p>
                  <p className="text-2xl font-semibold text-text">{safeAtrasados.length}</p>
                  <button
                    type="button"
                    onClick={() => goPedidos('atrasados')}
                    className="text-left text-sm font-medium text-accent-strong hover:text-accent"
                  >
                    Resolver atrasos &gt;
                  </button>
                </Card>
              </div>
            </div>
          </Card>
        </div>
      </PageSection>
    </OperationalBoard>
  )
}
