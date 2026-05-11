import { useState, useCallback, useEffect, useMemo } from 'react'
import { ArrowLeft, ArrowRight, Check, Cloud, CloudOff, Loader2, Pencil, X } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useMoneyInput } from '@renderer/lib/use-money-input'
import { redondearPrecioFinal } from '@shared/redondeo'
import { calcularEvaluacionComercial } from '@shared/comercial'
import type { EvaluacionComercial } from '@shared/comercial'
import { StepDots } from '@renderer/components/ui/step-dots'
import { ConfirmDialog } from '@renderer/components/shared/confirm-dialog'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { PrecioPanel } from '../precio-panel'
import { StepMedidas } from './step-medidas'
import { StepMarco } from './step-marco'
import { StepOpciones } from './step-opciones'
import { StepMateriales } from './step-materiales'
import { StepResumen } from './step-resumen'
import { StepResumenEmbed } from './step-resumen-embed'
import { PageLoader } from '@renderer/components/ui/spinner'
import { useIpc } from '@renderer/hooks/use-ipc'
import {
  clearAutoSaveDraft,
  loadAutoSaveDraft,
  useAutoSave,
  type AutoSaveStatus
} from '@renderer/hooks/use-auto-save'
import { validarWizardData } from './wizard-data-validation'
import type {
  TipoTrabajo,
  MuestraMarcoConProveedor,
  IpcResult,
  PrecioVidrio,
  ResultadoCotizacion,
  Cliente
} from '@shared/types'

export type MetodoPagoWizard = 'efectivo' | 'transferencia'

export type TipoEntregaWizard = 'estandar' | 'urgente' | 'sin_afan'

export type WizardData = {
  anchoCm: number
  altoCm: number
  muestraMarcoId: number | null
  muestraMarco: MuestraMarcoConProveedor | null
  conPaspartu: boolean
  tipoPaspartu: 'pintado' | 'acrilico'
  anchoPaspartuCm: number
  // Fase 2 §A.3 — listón de madera delgado decorativo en el interior del
  // paspartú. Solo aplica cuando conPaspartu está activo.
  conSuplemento: boolean
  conVidrio: boolean
  // tipoVidrio es texto libre — el usuario puede crear tipos nuevos en
  // Listas de precios (ej. "templado", "mate"). La lista de opciones se
  // lee dinámicamente de la DB en step-opciones.
  tipoVidrio: string
  porcentajeMateriales: number
  precioManual: number
  costoManualEstimado: number
  descripcionManual: string
  precioInstalacion: number
  costoInstalacionEstimado: number
  tipoVidrioEspejo: string
  // Ajuste comercial — vive en WizardData para que el panel lateral, el
  // resumen y el auto-save vean el mismo estado. Antes vivían como useState
  // local de step-resumen.tsx, lo que causaba: (1) el panel lateral nunca
  // mostraba el descuento aplicado; (2) volver atrás al wizard reseteaba el
  // descuento; (3) el auto-save no persistía el descuento.
  conDescuento: boolean
  descuentoNum: number
  motivoDescuento: string
  // Datos del pedido (paso final) — también suben aquí por consistencia.
  conAbono: boolean
  abonoNum: number
  metodoPago: MetodoPagoWizard
  notas: string
  tipoEntrega: TipoEntregaWizard
}

const INITIAL_DATA: WizardData = {
  anchoCm: 0,
  altoCm: 0,
  muestraMarcoId: null,
  muestraMarco: null,
  conPaspartu: false,
  tipoPaspartu: 'pintado',
  anchoPaspartuCm: 5,
  conSuplemento: false,
  conVidrio: true,
  tipoVidrio: '',
  porcentajeMateriales: 10,
  precioManual: 0,
  costoManualEstimado: 0,
  descripcionManual: '',
  precioInstalacion: 0,
  costoInstalacionEstimado: 0,
  tipoVidrioEspejo: '',
  conDescuento: false,
  descuentoNum: 0,
  motivoDescuento: '',
  conAbono: true,
  abonoNum: 0,
  metodoPago: 'efectivo',
  notas: '',
  tipoEntrega: 'estandar'
}

const STEPS = [
  { key: 'medidas', label: 'Medidas' },
  { key: 'marco', label: 'Marco' },
  { key: 'opciones', label: 'Opciones' },
  { key: 'materiales', label: 'Materiales' },
  { key: 'resumen', label: 'Resumen' }
] as const

export type WizardStepKey = (typeof STEPS)[number]['key'] | 'precio' | 'vidrio_tipo'

// Cálculo puro de los pasos visibles según tipo de trabajo. Fuera del
// componente para poder llamarlo desde el initializer de useState (que
// necesita conocer los pasos del tipoTrabajo actual para resolver el
// índice de `stepInicial`).
function computeVisibleSteps(
  tipoTrabajo: TipoTrabajo
): { key: WizardStepKey; label: string }[] {
  if (tipoTrabajo === 'enmarcacion_estandar') return [...STEPS]
  if (tipoTrabajo === 'restauracion') {
    return [
      { key: 'precio', label: 'Precio' },
      { key: 'resumen', label: 'Resumen' }
    ]
  }
  if (tipoTrabajo === 'vidrio_espejo') {
    return [
      { key: 'medidas', label: 'Medidas' },
      { key: 'vidrio_tipo', label: 'Tipo de vidrio' },
      { key: 'resumen', label: 'Resumen' }
    ]
  }
  if (tipoTrabajo === 'acolchado') {
    return [
      { key: 'medidas', label: 'Medidas' },
      { key: 'marco', label: 'Marco' },
      { key: 'materiales', label: 'Materiales' },
      { key: 'resumen', label: 'Resumen' }
    ]
  }
  if (tipoTrabajo === 'adherido') {
    // Fase 2 §A.6 — adherido no lleva marco/vidrio/paspartú, solo la
    // lámina pegada al MDF. Flujo mínimo: medidas → materiales → resumen.
    return [
      { key: 'medidas', label: 'Medidas' },
      { key: 'materiales', label: 'Materiales' },
      { key: 'resumen', label: 'Resumen' }
    ]
  }
  // Retablo, bastidor, tapa: medidas + materiales + resumen (sin marco/opciones).
  return [...STEPS].filter(
    (wizardStep) => wizardStep.key !== 'marco' && wizardStep.key !== 'opciones'
  )
}

// Resultado del wizard en modo embed: tipo de trabajo concreto + datos
// suficientes para que el padre construya el TrabajoCotizado del IPC
// `pedidos:crearMultiTrabajo`. Se usa solo cuando modo='embed'.
export type TrabajoConfirmadoEmbed = {
  tipoTrabajo: Exclude<TipoTrabajo, 'mixto'>
  data: WizardData
  cotizacion: ResultadoCotizacion
}

type WizardShellProps = {
  tipoTrabajo: TipoTrabajo
  onBack: () => void
  cliente: Cliente | null
  onClienteChange: (cliente: Cliente | null) => void
  /** Modo de operación:
   * - 'pedido-completo' (default): el wizard crea el pedido al confirmar
   *   en el último paso (flujo histórico, cotizador clásico).
   * - 'embed': el último paso es un resumen simple y el padre recibe el
   *   `TrabajoConfirmadoEmbed` via `onConfirmarEmbed`. Sin cliente picker,
   *   sin descuento, sin abono — esos viven en el wizard padre. */
  modo?: 'pedido-completo' | 'embed'
  /** Callback obligatorio si modo='embed'. */
  onConfirmarEmbed?: (trabajo: TrabajoConfirmadoEmbed) => void
  /** Datos pre-cargados para edición de un trabajo existente. Solo modo embed. */
  initialData?: Partial<WizardData>
  /** Paso en el que arrancar. Por defecto arranca en el primero. Útil al
   *  editar un trabajo existente: el usuario abre directamente el paso que
   *  quiere cambiar (marco, medidas, resumen) en lugar de re-recorrer
   *  el wizard completo. Si la key no existe en los pasos visibles para
   *  este tipoTrabajo, se ignora silenciosamente y arranca en 0. */
  stepInicial?: WizardStepKey
}

export function WizardShell({
  tipoTrabajo,
  onBack,
  cliente,
  onClienteChange,
  modo = 'pedido-completo',
  onConfirmarEmbed,
  initialData,
  stepInicial
}: WizardShellProps): React.JSX.Element {
  const isEmbed = modo === 'embed'
  const [step, setStep] = useState(() => {
    if (!stepInicial) return 0
    const steps = computeVisibleSteps(tipoTrabajo)
    const idx = steps.findIndex((s) => s.key === stepInicial)
    return idx >= 0 ? idx : 0
  })
  // Dirección del último cambio de paso, para escoger el keyframe de
  // entrada (right→ avance, ←left retroceso). Se aplica al wrapper
  // envuelto con key del step actual para forzar re-mount + animación.
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  // SPEC-001 — al montar, intentamos recuperar un draft previo para no perder
  // trabajo si el usuario cerró la app sin terminar. Se namespacea por tipoTrabajo.
  // En modo embed NO se autosave: cada trabajo es efímero hasta que se
  // confirma en el padre. El padre tiene su propio autosave del pedido.
  const draftKey = `cotizador:${tipoTrabajo}`
  const [data, setData] = useState<WizardData>(() => {
    if (initialData) return { ...INITIAL_DATA, ...initialData }
    if (isEmbed) return INITIAL_DATA
    // Validador profundo: si el draft está malformado (ej. data: null literal,
    // shape parcial por mismatch de versión, tampering local) loadAutoSaveDraft
    // devuelve null y borra la clave — la próxima visita arranca limpia.
    const draft = loadAutoSaveDraft<WizardData>(draftKey, validarWizardData)
    return draft?.data ?? INITIAL_DATA
  })
  const [cotizacion, setCotizacion] = useState<ResultadoCotizacion | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Auto-save cada 30s — ver Fase 3 v2 §7.2. Sólo guarda si el usuario ya
  // ingresó algo útil (evita poluir localStorage con drafts vacíos).
  const { status: autoSaveStatus, lastSavedAt } = useAutoSave<WizardData>({
    key: draftKey,
    data,
    intervalMs: 30000,
    debounceMs: 1500,
    // En modo embed, el wizard padre maneja su propio autosave del pedido
    // completo — `isDirty` retorna false para que `useAutoSave` no guarde
    // nada y no contamine los drafts de cotización rápida.
    isDirty: (d) =>
      !isEmbed &&
      (d.anchoCm > 0 ||
      d.altoCm > 0 ||
      d.muestraMarcoId !== null ||
      d.precioManual > 0 ||
      d.descripcionManual.length > 0 ||
      d.conDescuento ||
      d.descuentoNum > 0 ||
      d.notas.length > 0)
  })

  const { data: marcos, loading: marcosLoading } = useIpc<MuestraMarcoConProveedor[]>(
    () => window.api.cotizador.listarMuestrasMarcos(),
    []
  )
  const { data: margenMinimoAlertaPct } = useIpc<number>(
    () => window.api.configuracion.getNumber('margen_minimo_alerta_pct', 20),
    []
  )

  const updateData = useCallback((partial: Partial<WizardData>): void => {
    setData((prev) => ({ ...prev, ...partial }))
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') setShowExitConfirm(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    async function calculate(): Promise<void> {
      try {
        if (tipoTrabajo === 'restauracion') {
          if (data.precioManual <= 0) {
            setCotizacion(null)
            return
          }

          setCotizacion({
            items: [
              {
                tipoItem: 'restauracion',
                descripcion: data.descripcionManual || 'Restauración',
                subtotal: data.precioManual,
                cantidad: 1,
                precioUnitario: data.precioManual,
                costoUnitarioEstimado: data.costoManualEstimado > 0 ? data.costoManualEstimado : null,
                subtotalCostoEstimado: data.costoManualEstimado > 0 ? data.costoManualEstimado : null
              }
            ],
            subtotal: data.precioManual,
            totalMateriales: 0,
            brutoCotizado: data.precioManual,
            precioLista: redondearPrecioFinal(data.precioManual),
            precioTotal: redondearPrecioFinal(data.precioManual),
            costoEstimadoTotal: data.costoManualEstimado > 0 ? data.costoManualEstimado : null,
            margenEstimado:
              data.costoManualEstimado > 0
                ? redondearPrecioFinal(data.precioManual) - data.costoManualEstimado
                : null,
            margenEstimadoPct:
              data.costoManualEstimado > 0
                ? Math.round(
                    ((redondearPrecioFinal(data.precioManual) - data.costoManualEstimado) /
                      redondearPrecioFinal(data.precioManual)) *
                      10000
                  ) / 100
                : null,
            estadoRentabilidad:
              data.costoManualEstimado <= 0
                ? 'incompleta'
                : redondearPrecioFinal(data.precioManual) - data.costoManualEstimado <= 0
                  ? 'critica'
                  : ((redondearPrecioFinal(data.precioManual) - data.costoManualEstimado) /
                        redondearPrecioFinal(data.precioManual)) *
                        100 <
                      (margenMinimoAlertaPct ?? 20)
                    ? 'baja'
                    : 'saludable'
          })
          return
        }

        if (tipoTrabajo === 'vidrio_espejo' && (data.anchoCm <= 0 || data.altoCm <= 0)) {
          setCotizacion(null)
          return
        }

        if (data.anchoCm <= 0 || data.altoCm <= 0) {
          setCotizacion(null)
          return
        }

        if (!data.muestraMarcoId && needsMarco(tipoTrabajo)) {
          setCotizacion(null)
          return
        }

        let result: IpcResult<ResultadoCotizacion>

        if (tipoTrabajo === 'enmarcacion_estandar' && data.conPaspartu) {
          result = (await window.api.cotizador.enmarcacionPaspartu({
            anchoCm: data.anchoCm,
            altoCm: data.altoCm,
            anchoPaspartuCm: data.anchoPaspartuCm,
            tipoPaspartu: data.tipoPaspartu,
            muestraMarcoId: data.muestraMarcoId!,
            tipoVidrio: data.conVidrio ? data.tipoVidrio : 'ninguno',
            porcentajeMateriales: data.porcentajeMateriales,
            conSuplemento: data.conSuplemento
          })) as IpcResult<ResultadoCotizacion>
        } else if (tipoTrabajo === 'enmarcacion_estandar') {
          result = (await window.api.cotizador.enmarcacionEstandar({
            anchoCm: data.anchoCm,
            altoCm: data.altoCm,
            muestraMarcoId: data.muestraMarcoId!,
            tipoVidrio: data.conVidrio ? data.tipoVidrio : 'ninguno',
            porcentajeMateriales: data.porcentajeMateriales
          })) as IpcResult<ResultadoCotizacion>
        } else if (tipoTrabajo === 'acolchado') {
          // Fase 2 §A.5 — acolchado puede combinarse con marco opcional.
          // El backend hace la suma y aplica materiales adicionales con la
          // misma lógica que el resto del cotizador (clamp 5-10% + redondeo).
          result = (await window.api.cotizador.acolchado({
            anchoCm: data.anchoCm,
            altoCm: data.altoCm,
            muestraMarcoId: data.muestraMarcoId,
            porcentajeMateriales: data.porcentajeMateriales
          })) as IpcResult<ResultadoCotizacion>
        } else if (tipoTrabajo === 'adherido') {
          // Fase 2 §A.6 — adherido es standalone: solo lámina pegada sobre MDF
          // con Boxer. El backend decide la tarifa (x10 vs x7) según el tamaño.
          result = (await window.api.cotizador.adherido({
            anchoCm: data.anchoCm,
            altoCm: data.altoCm,
            porcentajeMateriales: data.porcentajeMateriales
          })) as IpcResult<ResultadoCotizacion>
        } else if (tipoTrabajo === 'retablo') {
          result = (await window.api.cotizador.retablo({
            anchoCm: data.anchoCm,
            altoCm: data.altoCm,
            porcentajeMateriales: data.porcentajeMateriales
          })) as IpcResult<ResultadoCotizacion>
        } else if (tipoTrabajo === 'bastidor') {
          result = (await window.api.cotizador.bastidor({
            anchoCm: data.anchoCm,
            altoCm: data.altoCm,
            porcentajeMateriales: data.porcentajeMateriales
          })) as IpcResult<ResultadoCotizacion>
        } else if (tipoTrabajo === 'tapa') {
          result = (await window.api.cotizador.tapa({
            anchoCm: data.anchoCm,
            altoCm: data.altoCm,
            porcentajeMateriales: data.porcentajeMateriales
          })) as IpcResult<ResultadoCotizacion>
        } else if (tipoTrabajo === 'vidrio_espejo') {
          // Fase 2 §A.8 — vidrio/espejo a domicilio usa el mismo redondeo 10→10
          // + instalación opcional. Endpoint dedicado para evitar depender de
          // una muestra de marco inexistente.
          result = (await window.api.cotizador.vidrioEspejo({
            anchoCm: data.anchoCm,
            altoCm: data.altoCm,
            tipoVidrio: data.tipoVidrioEspejo,
            precioInstalacion: data.precioInstalacion,
            costoInstalacionEstimado: data.costoInstalacionEstimado || null,
            descripcion: data.descripcionManual || null
          })) as IpcResult<ResultadoCotizacion>
        } else {
          return
        }

        if (result.ok) {
          setCotizacion(result.data)
        } else {
          setCotizacion(null)
        }
      } catch (err) {
        console.error('Cotizacion calculation failed:', err)
        setCotizacion(null)
      }
    }

    calculate()
  }, [
    tipoTrabajo,
    data.anchoCm,
    data.altoCm,
    data.muestraMarcoId,
    data.conPaspartu,
    data.conSuplemento,
    data.tipoPaspartu,
    data.anchoPaspartuCm,
    data.conVidrio,
    data.tipoVidrio,
    data.porcentajeMateriales,
    data.precioManual,
    data.costoManualEstimado,
    data.descripcionManual,
    data.precioInstalacion,
    data.costoInstalacionEstimado,
    data.tipoVidrioEspejo,
    margenMinimoAlertaPct
  ])

  // Evaluación comercial — única fuente de verdad para precio final, descuento
  // efectivo, costo y margen. Tanto el panel lateral como step-resumen leen
  // de aquí. Cambios en cotizacion o en data.descuentoNum se propagan al
  // panel automáticamente vía React.
  const evaluacionComercial: EvaluacionComercial = useMemo(
    () =>
      calcularEvaluacionComercial({
        precioSugerido: cotizacion?.precioLista ?? cotizacion?.precioTotal ?? 0,
        descuentoMonto: data.conDescuento ? data.descuentoNum : 0,
        costoEstimado: cotizacion?.costoEstimadoTotal ?? null,
        margenMinimoAlertaPct: margenMinimoAlertaPct ?? 20,
        autoRedondear: true
      }),
    [
      cotizacion?.precioLista,
      cotizacion?.precioTotal,
      cotizacion?.costoEstimadoTotal,
      data.conDescuento,
      data.descuentoNum,
      margenMinimoAlertaPct
    ]
  )

  const visibleSteps = computeVisibleSteps(tipoTrabajo)

  const currentStep = visibleSteps[step]
  const canContinue = canContinueFromStep(currentStep?.key, data, cotizacion)
  const stepGuidance = getStepGuidance(currentStep?.key, data, cotizacion)

  return (
    // Grid root: row1 header (auto), row2 scroll-area (1fr).
    // h-full + min-h-0 hace que el wizard ocupe toda la altura de <main>
    // sin desbordar — el scroll lo maneja la row 2. Así <main> deja de
    // scrollear este wizard y se evita el doble scroll container.
    <div
      className={cn(
        'grid grid-rows-[auto_1fr] min-h-0',
        // En modo página completa, el wizard ocupa todo el alto del <main>;
        // en modo embed, hereda la altura del modal padre (que ya tiene
        // max-h-[92vh] overflow-y-auto). Sin h-full, el modal scrollea de
        // forma natural en lugar de forzar al wizard a un alto fijo.
        isEmbed ? 'min-h-[60vh]' : 'h-full'
      )}
    >
      {/* Header propio del wizard — solo se muestra en modo página completa.
          En modo embed el modal padre ya provee título y botón X. */}
      {!isEmbed && (
        <div className="flex items-center justify-between pb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setShowExitConfirm(true)}>
              <ArrowLeft size={20} />
            </Button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-soft">
                Flujo activo
              </p>
              <p className="text-sm font-medium text-text">
                Completa cada decisión antes de avanzar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AutoSaveIndicator status={autoSaveStatus} lastSavedAt={lastSavedAt} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowExitConfirm(true)}
              aria-label="Cerrar cotización"
            >
              <X size={20} />
            </Button>
          </div>
        </div>
      )}

      {/* Row 2 del grid: único scroll container del wizard. min-h-0 es vital
          para que 1fr respete el overflow en descendientes. El flex interno
          lleva min-h-full para que el LEFT column siempre tenga al menos la
          altura del viewport — así el footer al final de la columna queda
          visible al fondo cuando el contenido es corto. */}
      <div className="overflow-y-auto min-h-0">
        {/* Barra compacta de precio — visible solo cuando el panel lateral
            está oculto (pantallas < lg). Muestra el precio final con
            descuento aplicado para que el dueño no se confunda. */}
        {evaluacionComercial.precioSugerido > 0 && (
          <div className="lg:hidden flex items-center justify-between rounded-lg border border-border bg-surface-muted px-4 py-3 mb-6">
            <span className="text-sm font-medium text-text">
              {evaluacionComercial.descuentoMonto > 0 ? 'Total con descuento' : 'Total sugerido'}
            </span>
            <PrecioDisplay
              value={evaluacionComercial.precioFinal}
              size="lg"
              className="text-accent"
            />
          </div>
        )}

        <div className="flex gap-6 lg:gap-8 min-h-full">
          {/* LEFT column: flex-col para anclar el footer al bottom de la
              columna de forma natural (sin sticky). Content en flex-1, footer
              como último hijo. Con min-h-full en el flex parent, el footer
              queda al fondo del viewport cuando hay poco contenido y al final
              del contenido cuando hay mucho — patrón clásico de wizards. */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1">
              <div className="mb-6 px-2">
                <StepDots
                  steps={[...visibleSteps]}
                  current={step}
                  onJump={(index) => {
                    setDirection(index >= step ? 'forward' : 'backward')
                    setStep(index)
                  }}
                />
              </div>

              {/* Banner de modo edición — solo en embed cuando se reciben
                  datos pre-cargados (es decir, el padre abrió este wizard
                  para editar un trabajo existente, no para agregar uno
                  nuevo). Recuerda al dueño que los puntos de arriba son
                  navegables — antes de los botones rápidos del lista, era
                  común que el dueño no se diera cuenta y recorriera los
                  5 pasos para cambiar una sola cosa. */}
              {isEmbed && initialData && (
                <div className="mb-4 px-2">
                  <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent-strong flex items-center gap-2">
                    <Pencil size={14} className="shrink-0" />
                    <span>
                      <strong>Editando un trabajo existente.</strong> Toca cualquier paso de arriba
                      para saltar directo a lo que quieras cambiar.
                    </span>
                  </div>
                </div>
              )}

              <GuidanceHint
                tone={stepGuidance.tone}
                title={stepGuidance.title}
                message={stepGuidance.message}
                className="mb-6"
              />

              <div
                key={currentStep?.key}
                className={
                  direction === 'forward'
                    ? 'animate-step-enter-forward'
                    : 'animate-step-enter-backward'
                }
              >
                {currentStep?.key === 'precio' && (
                  <StepPrecioManual data={data} onChange={updateData} tipoTrabajo={tipoTrabajo} />
                )}
                {currentStep?.key === 'medidas' && (
                  <StepMedidas data={data} onChange={updateData} />
                )}
                {currentStep?.key === 'vidrio_tipo' && (
                  <StepVidrioEspejo data={data} onChange={updateData} />
                )}
                {currentStep?.key === 'marco' &&
                  (marcosLoading ? (
                    <PageLoader />
                  ) : (
                    <StepMarco data={data} onChange={updateData} marcos={marcos ?? []} />
                  ))}
                {currentStep?.key === 'opciones' && (
                  <StepOpciones data={data} onChange={updateData} tipoTrabajo={tipoTrabajo} />
                )}
                {currentStep?.key === 'materiales' && (
                  <StepMateriales data={data} onChange={updateData} />
                )}
                {currentStep?.key === 'resumen' && !isEmbed && (
                  <StepResumen
                    data={data}
                    onChange={updateData}
                    cotizacion={cotizacion}
                    evaluacion={evaluacionComercial}
                    tipoTrabajo={tipoTrabajo}
                    cliente={cliente}
                    onClienteChange={onClienteChange}
                  />
                )}
                {currentStep?.key === 'resumen' && isEmbed && (
                  <StepResumenEmbed
                    data={data}
                    cotizacion={cotizacion}
                    tipoTrabajo={tipoTrabajo}
                    onCancelar={onBack}
                    onConfirmar={() => {
                      if (!cotizacion) return
                      if (tipoTrabajo === 'mixto') return
                      onConfirmarEmbed?.({
                        tipoTrabajo,
                        data,
                        cotizacion
                      })
                    }}
                  />
                )}
              </div>
            </div>

            {/* Footer al bottom del LEFT column — sin sticky. Al ser el último
                hijo de un flex-col con min-h igual al scroll-area, siempre
                queda al final visible cuando el contenido cabe, y al final
                del contenido (accesible vía scroll) cuando no cabe. Nunca se
                superpone sobre las tarjetas. */}
            <div className="mt-6 flex items-center justify-between border-t border-border bg-surface px-2 py-4 shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.08)]">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setDirection('backward')
                  setStep((current) => Math.max(0, current - 1))
                }}
                disabled={step === 0}
              >
                <ArrowLeft size={18} />
                Anterior
              </Button>
              {step < visibleSteps.length - 1 ? (
                <Button
                  size="lg"
                  onClick={() => {
                    setDirection('forward')
                    setStep((current) => current + 1)
                  }}
                  disabled={!canContinue}
                >
                  {canContinue
                    ? `Siguiente: ${visibleSteps[step + 1]?.label}`
                    : 'Completa este paso para continuar'}
                  {canContinue && <ArrowRight size={18} />}
                </Button>
              ) : null}
            </div>
          </div>

          {/* Panel de precio lateral — solo visible en pantallas anchas (lg+)
              para que el contenido del wizard tenga espacio suficiente. En
              pantallas normales se muestra la barra compacta de arriba.
              Recibe la evaluacionComercial completa para que el descuento y
              el margen se actualicen al instante cuando el usuario lo
              configura en el paso de resumen.
              En modo embed se oculta: el modal del padre limita el ancho y
              el StepResumenEmbed ya muestra el desglose completo al final. */}
          {!isEmbed && (
            <div className="w-72 shrink-0 hidden lg:block">
              <PrecioPanel
                items={cotizacion?.items ?? []}
                subtotal={cotizacion?.subtotal ?? 0}
                totalMateriales={cotizacion?.totalMateriales ?? 0}
                evaluacion={evaluacionComercial}
                porcentajeMateriales={data.porcentajeMateriales}
              />
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={() => {
          clearAutoSaveDraft(draftKey)
          onBack()
        }}
        title="¿Descartar cotización?"
        message="Si sales ahora, perderás los datos de esta cotización. ¿Estás seguro?"
        confirmLabel="Sí, salir"
        danger
      />
    </div>
  )
}

function canContinueFromStep(
  stepKey: WizardStepKey | undefined,
  data: WizardData,
  cotizacion: ResultadoCotizacion | null
): boolean {
  if (!stepKey) return false
  if (stepKey === 'medidas') return data.anchoCm > 0 && data.altoCm > 0
  if (stepKey === 'marco') return data.muestraMarcoId !== null
  if (stepKey === 'precio') return data.precioManual > 0
  if (stepKey === 'resumen') return cotizacion !== null
  return true
}

function getStepGuidance(
  stepKey: WizardStepKey | undefined,
  data: WizardData,
  cotizacion: ResultadoCotizacion | null
): { tone: 'info' | 'warning' | 'success' | 'accent'; title: string; message: string } {
  if (stepKey === 'medidas') {
    return data.anchoCm > 0 && data.altoCm > 0
      ? {
          tone: 'success',
          title: 'Medidas listas',
          message: `Ya puedes continuar con un formato base de ${data.anchoCm} × ${data.altoCm} cm.`
        }
      : {
          tone: 'accent',
          title: 'Empieza por la obra',
          message:
            'Ingresa el ancho y el alto interiores en centímetros. Ese dato ordena el resto de la cotización.'
        }
  }

  if (stepKey === 'marco') {
    return data.muestraMarcoId
      ? {
          tone: 'success',
          title: 'Marco seleccionado',
          message:
            'Perfecto. Confirma la referencia con el cliente y continúa con acabados o materiales.'
        }
      : {
          tone: 'warning',
          title: 'Falta escoger la muestra',
          message:
            'Selecciona la referencia física del marco para calcular bien el metraje y el precio.'
        }
  }

  if (stepKey === 'opciones') {
    return {
      tone: 'info',
      title: 'Define los acabados',
      message:
        'Aquí decides si el trabajo lleva paspartú, vidrio claro o antirreflectivo y cómo impacta el total.'
    }
  }

  if (stepKey === 'materiales') {
    return {
      tone: 'info',
      title: 'Ajusta lo operativo',
      message:
        'Usa este porcentaje para respaldo, pegantes, cintas y piolas. Entre 5% y 10% suele ser suficiente.'
    }
  }

  if (stepKey === 'resumen') {
    return cotizacion
      ? {
          tone: 'success',
          title: 'Cotización lista para cerrar',
          message:
            'El siguiente paso es generar PDF o convertir esta cotización en un pedido para seguir el proceso.'
        }
      : {
          tone: 'warning',
          title: 'Aún faltan datos',
          message:
            'Completa los pasos anteriores para calcular el total y habilitar la creación del pedido.'
        }
  }

  return {
    tone: 'info',
    title: 'Sigue paso a paso',
    message:
      'Completa la información de este módulo y revisa el panel lateral para validar el precio.'
  }
}

function needsMarco(tipo: TipoTrabajo): boolean {
  return tipo === 'enmarcacion_estandar'
}

// SPEC-001 — píldora pequeña que muestra el estado del auto-guardado.
// B-01: usamos useState + useEffect para evitar llamar `Date.now()` durante
// el render (React 19 marca esto como impure). El tick refresca el display
// "hace N min" cada 30 segundos sin acoplarnos al reloj del render.
function AutoSaveIndicator({
  status,
  lastSavedAt
}: {
  status: AutoSaveStatus
  lastSavedAt: Date | null
}): React.JSX.Element | null {
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    if (status !== 'saved' || !lastSavedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [status, lastSavedAt])

  if (status === 'idle') return null

  const base = 'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium'

  if (status === 'saving' || status === 'dirty') {
    return (
      <span
        className={cn(base, 'bg-surface-muted text-text-soft')}
        aria-live="polite"
        role="status"
      >
        <Loader2 size={12} className="animate-spin" />
        Guardando...
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className={cn(base, 'bg-error-bg text-error-strong')} aria-live="polite" role="status">
        <CloudOff size={12} />
        Error al guardar
      </span>
    )
  }

  const minutes = lastSavedAt ? Math.max(0, Math.round((now - lastSavedAt.getTime()) / 60000)) : 0
  const label = minutes === 0 ? 'Guardado ahora' : `Guardado hace ${minutes} min`

  return (
    <span
      className={cn(base, 'bg-success-bg text-success-strong')}
      aria-live="polite"
      role="status"
      title={lastSavedAt?.toLocaleString('es-CO')}
    >
      <Cloud size={12} />
      {label}
    </span>
  )
}

function StepVidrioEspejo({
  data,
  onChange
}: {
  data: WizardData
  onChange: (partial: Partial<WizardData>) => void
}): React.JSX.Element {
  // BR-010 — los precios se leen desde la tabla precios_vidrios para que el
  // dueño pueda editarlos sin tocar código.
  const { data: preciosVidrio } = useIpc<PrecioVidrio[]>(
    () => window.api.cotizador.listarPreciosVidrio(),
    []
  )
  const opcionesVidrio = preciosVidrio ?? []
  const vidrioSeleccionado =
    opcionesVidrio.find((p) => p.tipo === data.tipoVidrioEspejo) ?? opcionesVidrio[0]

  useEffect(() => {
    if (vidrioSeleccionado && vidrioSeleccionado.tipo !== data.tipoVidrioEspejo) {
      onChange({ tipoVidrioEspejo: vidrioSeleccionado.tipo })
    }
  }, [data.tipoVidrioEspejo, onChange, vidrioSeleccionado?.tipo])

  const formatPrecio = (v: number): string =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(v) + '/m²'

  // Redondeo de medidas a múltiplos de 10 hacia arriba (Fase 2 §A.2.1)
  const anchoRedondeado = data.anchoCm > 0 ? Math.ceil(data.anchoCm / 10) * 10 : 0
  const altoRedondeado = data.altoCm > 0 ? Math.ceil(data.altoCm / 10) * 10 : 0
  const areaM2 = (anchoRedondeado * altoRedondeado) / 10000
  const precioUnitario = vidrioSeleccionado?.precioM2 ?? 0
  const precioCalculado = Math.round(areaM2 * precioUnitario)
  const instalacion = useMoneyInput(data.precioInstalacion, (n) =>
    onChange({ precioInstalacion: n })
  )
  const costoInstalacion = useMoneyInput(data.costoInstalacionEstimado, (n) =>
    onChange({ costoInstalacionEstimado: n })
  )

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-text mb-1">Tipo de vidrio</h2>
      <p className="text-sm text-text-muted mb-6">
        Selecciona el tipo de vidrio y agrega el costo de instalación si aplica.
      </p>

      <div className="space-y-6 max-w-lg">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Tipo</p>
          {opcionesVidrio.length === 0 ? (
            <GuidanceHint
              tone="warning"
              title="Primero configura los vidrios"
              message="Agrega al menos un vidrio en Listas de precios para poder cotizar este servicio."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {opcionesVidrio.map((option) => (
                <button
                  key={option.id}
                  onClick={() => onChange({ tipoVidrioEspejo: option.tipo })}
                  className={cn(
                    'relative flex flex-col items-start p-4 rounded-lg border-2 cursor-pointer transition-all text-left',
                    data.tipoVidrioEspejo === option.tipo
                      ? 'border-accent bg-accent/10 shadow-1'
                      : 'border-border hover:border-border-strong'
                  )}
                >
                  {data.tipoVidrioEspejo === option.tipo && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-text">{option.nombre}</span>
                  <span className="text-xs text-text-muted mt-0.5">{option.espesorMm} mm</span>
                  <span className="text-xs font-medium text-accent-strong mt-1">
                    {formatPrecio(option.precioM2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {anchoRedondeado > 0 && altoRedondeado > 0 && (
          <div className="rounded-md border border-info/30 bg-info-bg px-4 py-3 text-sm text-info-strong">
            <p className="font-semibold mb-1">Cálculo del vidrio (Fase 2 §A.2)</p>
            <p className="text-xs leading-relaxed">
              Medidas {data.anchoCm} × {data.altoCm} cm → redondeadas a {anchoRedondeado} ×{' '}
              {altoRedondeado} cm (múltiplos de 10)
            </p>
            <p className="text-xs leading-relaxed mt-0.5">
              Área: {areaM2.toFixed(2)} m² × {formatPrecio(precioUnitario).replace('/m²', '')} ={' '}
              <span className="font-semibold tabular-nums">
                {new Intl.NumberFormat('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  minimumFractionDigits: 0
                }).format(precioCalculado)}
              </span>
            </p>
          </div>
        )}

        <Input
          label="Descripción (opcional)"
          value={data.descripcionManual}
          onChange={(event) => onChange({ descripcionManual: event.target.value })}
          placeholder="Ej: Espejo biselado para baño, ventana salón"
        />

        <Input
          label="Costo de instalación"
          type="text"
          inputMode="decimal"
          min={0}
          value={instalacion.raw}
          onChange={instalacion.handleChange}
          onBlur={instalacion.handleBlur}
          placeholder="0 si no aplica"
          hint="Incluye transporte y mano de obra de instalación a domicilio."
        />
        <Input
          label="Costo estimado de instalación (opcional)"
          type="text"
          inputMode="decimal"
          min={0}
          value={costoInstalacion.raw}
          onChange={costoInstalacion.handleChange}
          onBlur={costoInstalacion.handleBlur}
          placeholder="Ej: 45.000"
          hint="Se usa solo para calcular margen interno, no se muestra al cliente."
        />
      </div>
    </div>
  )
}

function StepPrecioManual({
  data,
  onChange,
  tipoTrabajo
}: {
  data: WizardData
  onChange: (partial: Partial<WizardData>) => void
  tipoTrabajo: TipoTrabajo
}): React.JSX.Element {
  const esRestauracion = tipoTrabajo === 'restauracion'

  const precio = useMoneyInput(data.precioManual, (n) => onChange({ precioManual: n }), {
    min: 0
  })
  const costo = useMoneyInput(data.costoManualEstimado, (n) => onChange({ costoManualEstimado: n }), {
    min: 0
  })

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-text mb-1">
        {esRestauracion ? 'Restauración' : 'Vidrio / Espejo'}
      </h2>
      <p className="text-sm text-text-muted mb-6">
        {esRestauracion
          ? 'El precio depende de la complejidad, los materiales y el tiempo estimado.'
          : 'Se mide en sitio y se cotiza por m2 (redondeado de 10 en 10) más instalación.'}
      </p>
      <div className="space-y-4 max-w-md">
        <Input
          label="Descripción del trabajo"
          value={data.descripcionManual}
          onChange={(event) => onChange({ descripcionManual: event.target.value })}
          placeholder={
            esRestauracion
              ? 'Ej: Reparación de marco dorado, retoque de esquinas'
              : 'Ej: Espejo biselado 80x120 + instalación'
          }
        />
        <Input
          label="Precio total"
          type="text"
          inputMode="decimal"
          min={1}
          value={precio.raw}
          onChange={precio.handleChange}
          onBlur={precio.handleBlur}
          placeholder="Ej: 150.000"
          hint="Este es el precio final que se cobrará al cliente."
        />
        <Input
          label="Costo estimado interno (opcional)"
          type="text"
          inputMode="decimal"
          min={0}
          value={costo.raw}
          onChange={costo.handleChange}
          onBlur={costo.handleBlur}
          placeholder="Ej: 80.000"
          hint="Sirve para calcular margen estimado sin mostrarlo al cliente."
        />
      </div>
    </div>
  )
}
