import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Building2, FileSpreadsheet, Rocket, Check, ArrowRight } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Card } from '@renderer/components/ui/card'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { cn } from '@renderer/lib/cn'
import { formatPrimaryShortcut } from '@renderer/lib/shortcuts'
import { useToast } from '@renderer/contexts/toast-context'
import type { IpcResult } from '@shared/types'

const STEPS = [
  { key: 'bienvenida', label: 'Bienvenida', icon: Sparkles },
  { key: 'datos', label: 'Datos', icon: Building2 },
  { key: 'precios', label: 'Precios', icon: FileSpreadsheet },
  { key: 'tour', label: 'Listo', icon: Rocket }
] as const

export default function OnboardingPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)

  // I-03: campos vacíos por defecto. El dueño confía más cuando la app NO
  // asume su identidad desde el primer click.
  const [datos, setDatos] = useState({
    nombre: '',
    rut: '',
    telefono: '',
    direccion: '',
    correo: ''
  })

  /**
   * C-01 — Marca el flag y navega a la ruta destino. Se llama tanto al
   * terminar el wizard normal como al elegir "Explorar con datos de ejemplo".
   */
  async function completarOnboarding(destino: string): Promise<void> {
    try {
      await window.api.configuracion.marcarOnboardingCompleto()
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
   * I-03 — Llama al backend para abrir el file picker y procesar el Excel.
   * Muestra toast con cuántos marcos se importaron.
   */
  async function importarDesdeExcel(): Promise<void> {
    setImporting(true)
    try {
      const result = (await window.api.excel.importarMarcos()) as IpcResult<{
        importados: number
        errores: string[]
      }>
      if (!result.ok) {
        showToast({
          tone: 'error',
          title: 'No se pudo importar',
          message: result.error
        })
        return
      }
      const { importados, errores } = result.data
      if (importados === 0 && errores.length === 0) {
        // Usuario canceló el diálogo
        return
      }
      showToast({
        tone: importados > 0 ? 'success' : 'warning',
        title: `${importados} marco${importados === 1 ? '' : 's'} importado${importados === 1 ? '' : 's'}`,
        message:
          errores.length > 0
            ? `${errores.length} fila(s) con errores: ${errores.slice(0, 2).join('; ')}${errores.length > 2 ? '…' : ''}`
            : 'Los precios están listos para usar en el cotizador.'
      })
      setStep(3)
    } finally {
      setImporting(false)
    }
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

      <Card padding="lg" className="w-full max-w-xl animate-fade-in-up">
        {step === 0 && (
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
              <Sparkles size={32} className="text-accent-strong" />
            </div>
            <h1 className="text-2xl font-semibold text-text mb-3">Bienvenido a Casa Alberto</h1>
            <p className="text-sm text-text-muted mb-6 max-w-sm mx-auto">
              Tu nueva herramienta para gestionar la marquetería. Vamos a dejar lista la base para
              cotizar, crear pedidos y facturar sin perder el hilo del proceso.
            </p>

            <GuidanceHint
              tone="accent"
              title="Qué vas a resolver en este onboarding"
              message="Primero guardas los datos del negocio, luego decides cómo cargar precios y al final entras al flujo principal recomendado."
              className="mb-8 text-left"
            />

            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button className="w-full" onClick={() => setStep(1)} disabled={loadingDemo}>
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
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold text-text mb-1">Datos del negocio</h2>
            <p className="text-sm text-text-muted mb-6">
              Estos datos aparecen en facturas, cotizaciones y contratos.
            </p>

            <GuidanceHint
              tone="info"
              title="Empieza por lo mínimo"
              message="Si hoy solo tienes a mano nombre, teléfono y dirección, con eso ya puedes avanzar y completar el resto más tarde."
              className="mb-6"
            />

            <div className="space-y-4">
              <Input
                label="Nombre del negocio"
                value={datos.nombre}
                onChange={(event) => setDatos((prev) => ({ ...prev, nombre: event.target.value }))}
              />
              <Input
                label="NIT / RUT"
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
                  label="Correo"
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
              <Button variant="secondary" onClick={() => setStep(0)}>
                Atrás
              </Button>
              <Button
                onClick={async () => {
                  await saveConfig()
                  setStep(2)
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
            <h2 className="text-xl font-semibold text-text mb-1">Precios iniciales</h2>
            <p className="text-sm text-text-muted mb-6">
              Puedes importar tu lista de precios o empezar con la base de ejemplo y ajustar luego.
            </p>

            <GuidanceHint
              tone="info"
              title="Recomendación para arrancar rápido"
              message="Si todavía no tienes el Excel listo, entra primero al cotizador, valida el flujo y vuelve a Configuración cuando quieras afinar precios."
              className="mb-6"
            />

            <div className="space-y-3 mb-8">
              <button
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-accent hover:bg-accent/5 cursor-pointer transition-colors text-left disabled:cursor-wait disabled:opacity-60"
                onClick={importarDesdeExcel}
                disabled={importing}
              >
                <FileSpreadsheet size={24} className="text-accent-strong shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text">
                    {importing ? 'Importando marcos…' : 'Importar marcos desde Excel'}
                  </p>
                  <p className="text-xs text-text-muted">
                    Sube un archivo .xlsx con tu lista de marcos (referencia, colilla,
                    precio/metro).
                  </p>
                </div>
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:border-border-strong cursor-pointer transition-colors text-left"
                onClick={() => setStep(3)}
              >
                <ArrowRight size={24} className="text-text-soft shrink-0" />
                <div>
                  <p className="text-sm font-medium text-text">Ingresar manualmente después</p>
                  <p className="text-xs text-text-muted">
                    Puedes agregar y editar precios desde Configuración y desde el cotizador.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
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
            <h2 className="text-xl font-semibold text-text mb-3">Todo listo</h2>
            <p className="text-sm text-text-muted mb-3 max-w-sm mx-auto">
              Ya tienes la base mínima para trabajar. Estos son los siguientes pasos más útiles:
            </p>
            <div className="text-left space-y-2 mb-8 max-w-sm mx-auto">
              {[
                'Crear tu primera cotización con ayuda paso a paso.',
                'Convertir una cotización en pedido y seguirla en el tablero.',
                'Generar facturas y registrar abonos sin perder el saldo.'
              ].map((text) => (
                <div key={text} className="flex items-center gap-2 text-sm text-text-muted">
                  <Check size={16} className="text-success-strong shrink-0" />
                  {text}
                </div>
              ))}
            </div>

            <GuidanceHint
              tone="success"
              title="Siguiente módulo recomendado"
              message="Empieza por el cotizador. Es la entrada natural del trabajo y desde ahí ya puedes crear pedidos y seguir el proceso completo."
              className="mb-6 text-left"
            />

            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <Button className="w-full" onClick={finishToCotizador}>
                <Rocket size={18} />
                Ir al cotizador
              </Button>
              <Button variant="secondary" className="w-full" onClick={finishToDashboard}>
                Ir al dashboard
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep(2)}>
                Atrás
              </Button>
              <p className="text-xs text-text-muted">
                Tip: usa{' '}
                <kbd className="px-1 py-0.5 bg-surface-muted rounded text-text-muted">
                  {formatPrimaryShortcut('k')}
                </kbd>{' '}
                para buscar cualquier cosa.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
