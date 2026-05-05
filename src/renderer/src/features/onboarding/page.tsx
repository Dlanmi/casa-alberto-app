import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  Building2,
  FileSpreadsheet,
  Rocket,
  Check,
  ArrowRight,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Card } from '@renderer/components/ui/card'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { Spinner } from '@renderer/components/ui/spinner'
import { Modal } from '@renderer/components/ui/modal'
import { cn } from '@renderer/lib/cn'
import { useToast } from '@renderer/contexts/toast-context'
import type { IpcResult, MuestraMarcoConProveedor } from '@shared/types'

type ResumenParseo = {
  negocio: number
  proveedores: number
  marcos: number
  vidrios: number
  paspartuPintado: number
  paspartuAcrilico: number
  retablos: number
  bastidores: number
  tapas: number
  configuracion: number
}

type ErrorPlantilla = {
  hoja: string
  fila: number
  campo?: string
  mensaje: string
}

type ResultadoParseo = {
  ok: boolean
  datos: unknown
  errores: ErrorPlantilla[]
  resumen: ResumenParseo
}

const STEPS = [
  { key: 'bienvenida', label: 'Bienvenida', icon: Sparkles },
  { key: 'datos', label: 'Datos', icon: Building2 },
  { key: 'precios', label: 'Precios', icon: FileSpreadsheet },
  { key: 'tour', label: 'Listo', icon: Rocket }
] as const

// Clave usada para persistir el paso actual del wizard. Así si el papá cierra
// la app a mitad (o se reinicia por otra razón) retomamos donde dejó en vez
// de empezar desde "Bienvenida". Se limpia al completar el onboarding.
const STEP_CONFIG_KEY = 'onboarding_step'

export default function OnboardingPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [step, setStepState] = useState(0)
  // Dirección del último cambio de paso, para escoger keyframe (right/left).
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  // Plantilla unificada — reemplaza el import legacy de marcos
  const [generandoPlantilla, setGenerandoPlantilla] = useState(false)
  const [subiendoPlantilla, setSubiendoPlantilla] = useState(false)
  const [parseado, setParseado] = useState<ResultadoParseo | null>(null)
  const [cargandoPlantilla, setCargandoPlantilla] = useState(false)
  // Detección de marcos cargados — para personalizar Step 3
  const [hayMarcos, setHayMarcos] = useState(false)

  // I-03: campos vacíos por defecto. El dueño confía más cuando la app NO
  // asume su identidad desde el primer click.
  const [datos, setDatos] = useState({
    nombre: '',
    rut: '',
    telefono: '',
    direccion: '',
    correo: ''
  })

  // Hidrata el wizard con lo que ya guardó el dueño antes de cerrar:
  //   - Paso actual (`onboarding_step`): evita empezar en "Bienvenida" cada vez
  //   - Datos del negocio (nombre_negocio, rut, etc.): pre-rellena el form
  //   - Marcos cargados: para personalizar el step 3 (CTA distinto si ya hay
  //     precios cargados vs si todavía no)
  // Si es la primera vez, los GETs devuelven vacío y el wizard se ve idéntico
  // al original. Sólo bloqueamos el render hasta terminar para evitar que el
  // usuario vea un flash del paso 0 antes de saltar al paso correcto.
  useEffect(() => {
    let cancelled = false
    async function hidratar(): Promise<void> {
      try {
        const stepResult = (await window.api.configuracion.get(STEP_CONFIG_KEY)) as IpcResult<
          string | null
        >
        if (!cancelled && stepResult.ok && stepResult.data) {
          const parsed = parseInt(stepResult.data, 10)
          if (Number.isInteger(parsed) && parsed >= 0 && parsed < STEPS.length) {
            setStepState(parsed)
          }
        }
        const claves = ['nombre_negocio', 'rut', 'telefono', 'direccion', 'correo'] as const
        const pares = await Promise.all(
          claves.map(
            (clave) => window.api.configuracion.get(clave) as Promise<IpcResult<string | null>>
          )
        )
        if (cancelled) return
        setDatos({
          nombre: pares[0]?.ok ? (pares[0].data ?? '') : '',
          rut: pares[1]?.ok ? (pares[1].data ?? '') : '',
          telefono: pares[2]?.ok ? (pares[2].data ?? '') : '',
          direccion: pares[3]?.ok ? (pares[3].data ?? '') : '',
          correo: pares[4]?.ok ? (pares[4].data ?? '') : ''
        })
        // Detección de marcos: si ya hay alguno cargado, el step 3 sugiere
        // ir directo al cotizador. Si no hay, sugiere cargar plantilla primero.
        const marcosRes = (await window.api.cotizador.listarMuestrasMarcos()) as IpcResult<
          MuestraMarcoConProveedor[]
        >
        if (!cancelled && marcosRes.ok) {
          setHayMarcos(marcosRes.data.length > 0)
        }
      } catch (err) {
        // Si algo falla, arrancamos el wizard "limpio" (no bloqueamos al papá).
        console.error('[onboarding] hidratación falló, arranco desde cero', err)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    hidratar()
    return () => {
      cancelled = true
    }
  }, [])

  // Wrapper de setStep que además persiste el nuevo valor en config. Acepta
  // value o updater igual que useState. Avance optimista — el state cambia
  // de inmediato para que la UI responda. Si la persistencia falla, revertimos
  // al paso anterior y avisamos: si papá cerrara la app sin saberlo, volvería
  // a un paso desactualizado al reabrir.
  const setStep = useCallback(
    (next: number | ((prev: number) => number)) => {
      setStepState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        window.api.configuracion
          .guardar({
            clave: STEP_CONFIG_KEY,
            valor: String(resolved),
            descripcion: 'Paso actual del wizard de onboarding'
          })
          .catch((err) => {
            console.error('[onboarding] no se pudo persistir el step', err)
            showToast({
              tone: 'error',
              title: 'No se pudo guardar el paso',
              message: 'Reintenta. Si cierras la app ahora podrías volver a un paso anterior.'
            })
            // Revertir solo si nadie ha cambiado el step después de nuestro
            // intento — si papá ya avanzó a otra parte, respetamos su acción.
            setStepState((current) => (current === resolved ? prev : current))
          })
        return resolved
      })
    },
    [showToast]
  )

  // Wrapper que captura la dirección antes de cambiar de paso, para que el
  // contenedor animado escoja el keyframe correcto. setStep ya persiste.
  function goToStep(target: number): void {
    setDirection(target >= step ? 'forward' : 'backward')
    setStep(target)
  }

  /**
   * Marca el flag de onboarding completado y navega a la ruta destino. Se
   * llama tanto al terminar el wizard normal como al elegir "Explorar con
   * datos de ejemplo". Limpia el paso persistido para que si el flag se
   * resetea (soporte, reinstalación) el wizard arranque limpio en
   * "Bienvenida".
   */
  async function completarOnboarding(destino: string): Promise<void> {
    try {
      await window.api.configuracion.marcarOnboardingCompleto()
      await window.api.configuracion.guardar({
        clave: STEP_CONFIG_KEY,
        valor: '0',
        descripcion: 'Paso actual del wizard de onboarding'
      })
    } catch (err) {
      // Si esto falla el usuario va a volver al onboarding al reabrir,
      // no es catastrófico pero sí raro. Logueamos y navegamos igual.
      console.error('[onboarding] no se pudo marcar el flag', err)
    }
    navigate(destino, { replace: true })
  }

  /**
   * Carga los datos de demostración y marca onboarding como completo.
   * Muestra toast de confirmación para que el dueño sepa qué está viendo.
   */
  async function cargarDatosDemo(): Promise<void> {
    setLoadingDemo(true)
    try {
      const result = (await window.api.app.loadDemoData()) as IpcResult<void>
      if (!result.ok) {
        showToast({
          tone: 'error',
          title: 'No se pudieron cargar los datos de ejemplo',
          message: result.error
        })
        return
      }
      showToast({
        tone: 'info',
        title: 'Datos de ejemplo cargados',
        message:
          'Estás viendo clientes, pedidos y facturas de demostración. Cuando estés listo, puedes borrarlos desde Configuración.'
      })
      await completarOnboarding('/')
    } finally {
      setLoadingDemo(false)
    }
  }

  /**
   * Descarga la plantilla unificada vacía y abre el explorador para que el
   * dueño la encuentre. La plantilla incluye todas las listas (proveedores,
   * marcos, vidrios, paspartú, retablos, bastidores, tapas, configuración).
   */
  async function handleDescargarPlantilla(): Promise<void> {
    setGenerandoPlantilla(true)
    try {
      const res = (await window.api.excel.plantilla.generar()) as IpcResult<string>
      if (res.ok) {
        showToast({
          tone: 'success',
          title: 'Plantilla descargada',
          message:
            'Se guardó en la carpeta Descargas y se abrió el explorador. Llénala con tus datos y vuelve aquí para subirla.'
        })
      } else {
        showToast({ tone: 'error', title: 'No se pudo generar', message: res.error })
      }
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Error al generar plantilla',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setGenerandoPlantilla(false)
    }
  }

  /**
   * Sube la plantilla llenada y abre el modal de preview para confirmar la
   * carga. Si hay errores, muestra el detalle. Si todo OK, permite cargar.
   */
  async function handleSubirPlantilla(): Promise<void> {
    setSubiendoPlantilla(true)
    try {
      const res = (await window.api.excel.plantilla.subir()) as IpcResult<ResultadoParseo | null>
      if (!res.ok) {
        showToast({ tone: 'error', title: 'No se pudo leer la plantilla', message: res.error })
        return
      }
      if (res.data === null) return // usuario canceló el dialogo
      setParseado(res.data)
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Error al subir plantilla',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setSubiendoPlantilla(false)
    }
  }

  /**
   * Confirma la carga de la plantilla parseada (modo upsert siempre en
   * onboarding — es el caso más común y seguro).
   */
  async function handleCargarPlantilla(): Promise<void> {
    if (!parseado || !parseado.ok) return
    setCargandoPlantilla(true)
    try {
      const res = (await window.api.excel.plantilla.cargar(parseado.datos, 'upsert')) as IpcResult<{
        creados: ResumenParseo
      }>
      if (!res.ok) {
        showToast({ tone: 'error', title: 'Error al cargar', message: res.error })
        return
      }
      const total = Object.values(res.data.creados).reduce((a, n) => a + n, 0)
      showToast({
        tone: 'success',
        title: 'Datos cargados',
        message: `Se cargaron ${total} elementos a tu negocio. Vamos al paso final.`
      })
      setParseado(null)
      // Refrescar la detección de marcos para personalizar el step 3
      const marcos = (await window.api.cotizador.listarMuestrasMarcos()) as IpcResult<
        MuestraMarcoConProveedor[]
      >
      if (marcos.ok) setHayMarcos(marcos.data.length > 0)
      goToStep(3)
    } finally {
      setCargandoPlantilla(false)
    }
  }

  /**
   * Saltar el wizard sin configurar nada. Marca onboarding completado y va
   * al dashboard. El dueño puede configurar después desde Configuración.
   */
  async function saltarWizard(): Promise<void> {
    showToast({
      tone: 'info',
      title: 'Wizard saltado',
      message:
        'Puedes configurar todo en cualquier momento desde Configuración → "Cargar datos desde plantilla Excel".'
    })
    await completarOnboarding('/')
  }

  async function saveConfig(): Promise<void> {
    setSaving(true)
    try {
      const entries = [
        { clave: 'nombre_negocio', valor: datos.nombre, descripcion: 'Nombre del negocio' },
        { clave: 'rut', valor: datos.rut, descripcion: 'RUT del negocio' },
        { clave: 'telefono', valor: datos.telefono, descripcion: 'Teléfono del negocio' },
        { clave: 'direccion', valor: datos.direccion, descripcion: 'Dirección del negocio' },
        { clave: 'correo', valor: datos.correo, descripcion: 'Correo electrónico' }
      ]

      for (const entry of entries) {
        if (entry.valor) {
          await window.api.configuracion.guardar(entry)
        }
      }

      showToast({
        tone: 'success',
        title: 'Datos del negocio guardados',
        message: 'Ya puedes continuar con precios iniciales o entrar al cotizador.'
      })
    } catch {
      showToast({
        tone: 'error',
        title: 'No se pudieron guardar los datos',
        message: 'Revisa la información e inténtalo de nuevo.'
      })
    } finally {
      setSaving(false)
    }
  }

  async function finishToDashboard(): Promise<void> {
    await completarOnboarding('/')
  }

  async function finishToCotizador(): Promise<void> {
    await completarOnboarding('/cotizador')
  }

  // Evita el flash del paso 0 antes de saltar al paso persistido. Menos de
  // 50ms típicos — el papá no percibe el loader, pero no ve un salto extraño.
  if (!hydrated) {
    return <div className="min-h-screen bg-canvas" />
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-8">
      <div className="flex gap-2 mb-8">
        {STEPS.map((stepItem, index) => {
          const Icon = stepItem.icon

          return (
            <div
              key={stepItem.key}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                index === step
                  ? 'bg-accent text-white'
                  : index < step
                    ? 'bg-success-bg text-success-strong'
                    : 'bg-surface-muted text-text-soft'
              )}
            >
              {index < step ? <Check size={12} /> : <Icon size={12} />}
              {stepItem.label}
            </div>
          )
        })}
      </div>

      <Card padding="lg" className="w-full max-w-xl animate-fade-in-up overflow-hidden">
        <div
          key={step}
          className={
            direction === 'forward' ? 'animate-step-enter-forward' : 'animate-step-enter-backward'
          }
        >
          {step === 0 && (
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles size={32} className="text-accent-strong" />
              </div>
              <h1 className="text-2xl font-semibold text-text mb-3">Bienvenido a Casa Alberto</h1>
              <p className="text-sm text-text-muted mb-6 max-w-sm mx-auto">
                Tu nueva herramienta para gestionar la marquetería. En 3 pasos tienes todo listo.
              </p>

              <GuidanceHint
                tone="accent"
                title="Cómo funciona"
                message="(1) Datos básicos del negocio. (2) Cargas tus precios desde un Excel que descargas aquí. (3) Listo para cotizar."
                className="mb-8 text-left"
              />

              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <Button className="w-full" onClick={() => goToStep(1)} disabled={loadingDemo}>
                  <ArrowRight size={18} />
                  Comenzar configuración
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={cargarDatosDemo}
                  disabled={loadingDemo}
                >
                  {loadingDemo ? 'Cargando datos de ejemplo…' : 'Explorar con datos de ejemplo'}
                </Button>
                <button
                  type="button"
                  onClick={saltarWizard}
                  className="text-xs text-text-muted hover:text-text underline-offset-4 hover:underline cursor-pointer pt-2"
                >
                  Saltar el wizard y configurar después
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold tracking-tight text-text mb-1">Datos del negocio</h2>
              <p className="text-sm text-text-muted mb-6">
                Estos datos aparecen en facturas, cotizaciones y contratos.
              </p>

              <GuidanceHint
                tone="info"
                title="Si no tienes todo a mano, no pasa nada"
                message="Llena lo que sepas y deja vacío el resto. Puedes completar después en Configuración."
                className="mb-6"
              />

              <div className="space-y-4">
                <Input
                  label="Nombre del negocio"
                  value={datos.nombre}
                  onChange={(event) =>
                    setDatos((prev) => ({ ...prev, nombre: event.target.value }))
                  }
                  placeholder="Casa Alberto"
                />
                <Input
                  label="NIT / Cédula"
                  value={datos.rut}
                  onChange={(event) => setDatos((prev) => ({ ...prev, rut: event.target.value }))}
                  placeholder="Ej: 79.234.567-1"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Teléfono"
                    value={datos.telefono}
                    onChange={(event) =>
                      setDatos((prev) => ({ ...prev, telefono: event.target.value }))
                    }
                    placeholder="Ej: 310 234 5678"
                  />
                  <Input
                    label="Correo (opcional)"
                    type="email"
                    value={datos.correo}
                    onChange={(event) =>
                      setDatos((prev) => ({ ...prev, correo: event.target.value }))
                    }
                    placeholder="correo@ejemplo.com"
                  />
                </div>
                <Input
                  label="Dirección"
                  value={datos.direccion}
                  onChange={(event) =>
                    setDatos((prev) => ({ ...prev, direccion: event.target.value }))
                  }
                  placeholder="Cra 7 #185-42, Bogotá"
                />
              </div>
              <div className="flex justify-between mt-8">
                <Button variant="secondary" onClick={() => goToStep(0)}>
                  Atrás
                </Button>
                <Button
                  onClick={async () => {
                    await saveConfig()
                    goToStep(2)
                  }}
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Guardar y continuar'}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold tracking-tight text-text mb-1">
                Lista de precios
              </h2>
              <p className="text-sm text-text-muted mb-6">
                Carga proveedores, marcos, vidrios y demás listas de una sola vez con la plantilla
                Excel.
              </p>

              <GuidanceHint
                tone="info"
                title="Cómo funciona"
                message="(1) Descarga la plantilla. (2) Llénala con los datos de tu negocio (puedes hacerlo con tu papá). (3) Vuelve aquí y súbela. (4) La app valida y carga todo automáticamente."
                className="mb-6"
              />

              <div className="space-y-3 mb-8">
                <button
                  className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 cursor-pointer transition-colors text-left disabled:cursor-wait disabled:opacity-60"
                  onClick={handleDescargarPlantilla}
                  disabled={generandoPlantilla}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    {generandoPlantilla ? (
                      <Spinner size="sm" />
                    ) : (
                      <Download size={20} className="text-accent-strong" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text">
                      {generandoPlantilla ? 'Generando plantilla...' : '1. Descargar plantilla vacía'}
                    </p>
                    <p className="text-xs text-text-muted">
                      Crea un archivo Excel con todas las hojas necesarias. Se guarda en Descargas
                      y se abre el explorador.
                    </p>
                  </div>
                </button>

                <button
                  className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-success hover:bg-success-bg/40 cursor-pointer transition-colors text-left disabled:cursor-wait disabled:opacity-60"
                  onClick={handleSubirPlantilla}
                  disabled={subiendoPlantilla}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-bg">
                    {subiendoPlantilla ? (
                      <Spinner size="sm" />
                    ) : (
                      <Upload size={20} className="text-success-strong" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text">
                      {subiendoPlantilla ? 'Leyendo plantilla...' : '2. Subir plantilla llenada'}
                    </p>
                    <p className="text-xs text-text-muted">
                      Cuando tengas el Excel con los datos reales, súbelo aquí.
                    </p>
                  </div>
                </button>

                <button
                  className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-border-strong cursor-pointer transition-colors text-left"
                  onClick={() => goToStep(3)}
                >
                  <ArrowRight size={20} className="text-text-soft shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-text">Configurar precios después</p>
                    <p className="text-xs text-text-muted">
                      Saltar este paso. Puedes cargar precios desde Configuración cuando quieras.
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => goToStep(1)}>
                  Atrás
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-6">
                <Rocket size={32} className="text-success-strong" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-text mb-3">Todo listo</h2>

              {hayMarcos ? (
                <>
                  <p className="text-sm text-text-muted mb-6 max-w-sm mx-auto">
                    Ya tienes precios cargados. Empieza creando tu primera cotización.
                  </p>
                  <div className="flex flex-col gap-3 max-w-xs mx-auto">
                    <Button className="w-full" onClick={finishToCotizador}>
                      <Rocket size={18} />
                      Ir al cotizador
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={finishToDashboard}>
                      Ir al dashboard
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-text-muted mb-6 max-w-sm mx-auto">
                    Para cotizar necesitas tener al menos un marco cargado. Te recomiendo cargar
                    la plantilla primero.
                  </p>
                  <GuidanceHint
                    tone="warning"
                    title="Sin precios cargados"
                    message="Si entras al cotizador sin marcos, no podrás generar cotizaciones. Carga la plantilla en Configuración primero."
                    className="mb-6 text-left"
                  />
                  <div className="flex flex-col gap-3 max-w-xs mx-auto">
                    <Button className="w-full" onClick={() => completarOnboarding('/configuracion')}>
                      <FileSpreadsheet size={18} />
                      Cargar precios primero
                    </Button>
                    <Button variant="ghost" className="w-full" onClick={finishToCotizador}>
                      Ir al cotizador igual
                    </Button>
                  </div>
                </>
              )}

              <Button variant="ghost" className="mt-3" onClick={() => goToStep(2)}>
                Atrás
              </Button>
            </div>
          )}
        </div>
      </Card>

      {parseado && (
        <Modal
          open
          onClose={() => setParseado(null)}
          title="Vista previa de la plantilla"
          size="lg"
        >
          {parseado.ok ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success-bg p-3">
                <CheckCircle2 size={20} className="shrink-0 text-success-strong" />
                <p className="text-sm text-success-strong">
                  Plantilla válida.{' '}
                  <strong>
                    {Object.values(parseado.resumen).reduce((a, n) => a + n, 0)} elementos
                  </strong>{' '}
                  listos para cargar.
                </p>
              </div>

              <div className="rounded-md bg-surface-muted/50 p-3 space-y-1 text-sm">
                {Object.entries(parseado.resumen).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-text-muted capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                    <span
                      className={cn(
                        'tabular-nums font-medium',
                        v === 0 ? 'text-text-soft' : 'text-text'
                      )}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" className="flex-1" onClick={() => setParseado(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCargarPlantilla}
                  disabled={cargandoPlantilla}
                  className="flex-1"
                >
                  {cargandoPlantilla ? <Spinner size="sm" /> : <FileSpreadsheet size={16} />}
                  {cargandoPlantilla ? 'Cargando...' : 'Cargar a la app'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-warning/30 bg-warning-bg p-3 flex items-start gap-3">
                <AlertTriangle size={20} className="shrink-0 text-warning-strong" />
                <div>
                  <p className="text-sm font-semibold text-warning-strong">
                    La plantilla tiene {parseado.errores.length}{' '}
                    {parseado.errores.length === 1 ? 'error' : 'errores'}
                  </p>
                  <p className="mt-1 text-xs text-text">
                    Corrige los siguientes puntos en el Excel y vuelve a subirlo. No se cargó nada.
                  </p>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-muted">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Hoja
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Fila
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Problema
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseado.errores.map((e, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs text-text">{e.hoja}</td>
                        <td className="px-3 py-2 tabular-nums text-text-muted">
                          {e.fila > 0 ? e.fila : '—'}
                        </td>
                        <td className="px-3 py-2 text-error-strong">
                          {e.campo ? `[${e.campo}] ` : ''}
                          {e.mensaje}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={() => setParseado(null)} className="w-full">
                Cerrar y corregir
              </Button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
