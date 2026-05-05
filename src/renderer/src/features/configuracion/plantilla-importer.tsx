// Sección de la página de Configuración para descargar y subir la plantilla
// Excel unificada que carga todas las listas de precios + datos del negocio en
// un solo paso. Incluye preview con conteo de elementos y errores antes de
// confirmar la carga.
import { useState } from 'react'
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Save
} from 'lucide-react'
import { Card, CardTitle } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Modal } from '@renderer/components/ui/modal'
import { Spinner } from '@renderer/components/ui/spinner'
import { useToast } from '@renderer/contexts/toast-context'
import { cn } from '@renderer/lib/cn'
import type { IpcResult } from '@shared/types'

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

type ModoCarga = 'upsert' | 'solo_agregar' | 'reemplazar'

const RESUMEN_LABELS: Record<keyof ResumenParseo, string> = {
  negocio: 'Datos del negocio',
  proveedores: 'Proveedores',
  marcos: 'Marcos',
  vidrios: 'Vidrios',
  paspartuPintado: 'Paspartú pintado',
  paspartuAcrilico: 'Paspartú acrílico',
  retablos: 'Retablos',
  bastidores: 'Bastidores',
  tapas: 'Tapas',
  configuracion: 'Configuración general'
}

const MODO_LABELS: Record<ModoCarga, { titulo: string; descripcion: string }> = {
  upsert: {
    titulo: 'Actualizar y agregar (recomendado)',
    descripcion:
      'Si una referencia, vidrio o medida ya existe, actualiza sus precios. Si no existe, la crea.'
  },
  solo_agregar: {
    titulo: 'Solo agregar nuevos',
    descripcion:
      'Ignora referencias y medidas que ya existen en la app. Solo agrega lo nuevo. Útil si quieres preservar precios actuales y sumar nuevas referencias.'
  },
  reemplazar: {
    titulo: 'Reemplazar todo (¡cuidado!)',
    descripcion:
      'Borra TODOS los marcos, vidrios, listas de medidas y proveedores actuales antes de cargar lo nuevo. Solo úsalo para empezar limpio.'
  }
}

export function PlantillaImporter(): React.JSX.Element {
  const { showToast } = useToast()
  const [generando, setGenerando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [parseado, setParseado] = useState<ResultadoParseo | null>(null)
  const [modo, setModo] = useState<ModoCarga>('upsert')
  const [cargando, setCargando] = useState(false)
  const [confirmReemplazar, setConfirmReemplazar] = useState(false)

  async function handleDescargar(): Promise<void> {
    setGenerando(true)
    try {
      const res = (await window.api.excel.plantilla.generar()) as IpcResult<string>
      if (res.ok) {
        showToast({
          tone: 'success',
          title: 'Plantilla descargada',
          message: `Se guardó en Descargas y se abrió la carpeta. Llénala y vuelve aquí.`
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
      setGenerando(false)
    }
  }

  async function handleExportar(): Promise<void> {
    setExportando(true)
    try {
      const res = (await window.api.excel.plantilla.exportarActual()) as IpcResult<string>
      if (res.ok) {
        showToast({
          tone: 'success',
          title: 'Configuración exportada',
          message: 'Se guardó en Descargas con el formato de la plantilla. Puedes editarla y subirla de nuevo.'
        })
      } else {
        showToast({ tone: 'error', title: 'No se pudo exportar', message: res.error })
      }
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Error al exportar',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setExportando(false)
    }
  }

  async function handleSubir(): Promise<void> {
    setSubiendo(true)
    try {
      const res = (await window.api.excel.plantilla.subir()) as IpcResult<ResultadoParseo | null>
      if (!res.ok) {
        showToast({ tone: 'error', title: 'No se pudo leer la plantilla', message: res.error })
        return
      }
      if (res.data === null) {
        // El usuario canceló el dialogo
        return
      }
      setParseado(res.data)
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Error al subir plantilla',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setSubiendo(false)
    }
  }

  async function handleCargar(): Promise<void> {
    if (!parseado || !parseado.ok) return
    if (modo === 'reemplazar' && !confirmReemplazar) {
      setConfirmReemplazar(true)
      return
    }
    setCargando(true)
    try {
      const res = (await window.api.excel.plantilla.cargar(parseado.datos, modo)) as IpcResult<{
        creados: ResumenParseo
        actualizados: ResumenParseo
        ignorados: ResumenParseo
      }>
      if (!res.ok) {
        showToast({ tone: 'error', title: 'Error al cargar', message: res.error })
        return
      }
      const totalCreados = sumarResumen(res.data.creados)
      const totalActualizados = sumarResumen(res.data.actualizados)
      const totalIgnorados = sumarResumen(res.data.ignorados)
      showToast({
        tone: 'success',
        title: 'Datos cargados',
        message: `${totalCreados} creados · ${totalActualizados} actualizados${
          totalIgnorados > 0 ? ` · ${totalIgnorados} ignorados` : ''
        }.`
      })
      setParseado(null)
      setConfirmReemplazar(false)
      // Refresca el resto de la app después de cargar masivamente.
      setTimeout(() => window.location.reload(), 800)
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'Error inesperado al cargar',
        message: err instanceof Error ? err.message : 'Error desconocido'
      })
    } finally {
      setCargando(false)
    }
  }

  function handleCerrar(): void {
    setParseado(null)
    setConfirmReemplazar(false)
  }

  return (
    <Card padding="md" className="space-y-4 border-border bg-surface">
      <div>
        <CardTitle>Cargar datos desde plantilla Excel</CardTitle>
        <p className="text-sm text-text-muted mt-1">
          Carga todos los datos del negocio (proveedores, marcos, vidrios, paspartú, retablos,
          bastidores, tapas y configuración) en una sola operación. Útil para configurar la app la
          primera vez o para actualizar precios masivamente.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-surface-muted/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
              1
            </span>
            <p className="text-sm font-semibold text-text">Descargar plantilla vacía</p>
          </div>
          <p className="text-xs text-text-muted">
            Genera un archivo Excel con todas las hojas necesarias y ejemplos. Se guarda en tu
            carpeta de Descargas y se abre el explorador para que la encuentres fácil.
          </p>
          <Button onClick={handleDescargar} disabled={generando} className="w-full">
            {generando ? <Spinner size="sm" /> : <Download size={16} />}
            {generando ? 'Generando...' : 'Descargar plantilla'}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-surface-muted/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
              2
            </span>
            <p className="text-sm font-semibold text-text">Subir plantilla llenada</p>
          </div>
          <p className="text-xs text-text-muted">
            Una vez tengas la plantilla con los datos reales, súbela aquí. Verás una vista previa
            antes de confirmar la carga, así puedes revisar antes.
          </p>
          <Button
            onClick={handleSubir}
            disabled={subiendo}
            variant="secondary"
            className="w-full"
          >
            {subiendo ? <Spinner size="sm" /> : <Upload size={16} />}
            {subiendo ? 'Leyendo...' : 'Subir plantilla'}
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-dashed border-border p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-xs font-medium text-text">¿Ya tienes datos cargados?</p>
          <p className="text-xs text-text-muted">
            Exporta la configuración actual al formato de plantilla. Útil como backup o para editar
            precios en Excel y volver a subirlos.
          </p>
        </div>
        <Button
          onClick={handleExportar}
          disabled={exportando}
          variant="ghost"
          size="sm"
          className="shrink-0"
        >
          {exportando ? <Spinner size="sm" /> : <Save size={14} />}
          {exportando ? 'Exportando...' : 'Exportar configuración actual'}
        </Button>
      </div>

      {parseado && (
        <Modal open onClose={handleCerrar} title="Vista previa de la plantilla" size="lg">
          {parseado.ok ? (
            <PreviewExitoso
              parseado={parseado}
              modo={modo}
              onModoChange={setModo}
              onCancelar={handleCerrar}
              onConfirmar={handleCargar}
              cargando={cargando}
              confirmReemplazar={confirmReemplazar}
              onCancelarConfirmReemplazar={() => setConfirmReemplazar(false)}
            />
          ) : (
            <PreviewConErrores parseado={parseado} onCerrar={handleCerrar} />
          )}
        </Modal>
      )}
    </Card>
  )
}

function sumarResumen(r: ResumenParseo): number {
  return Object.values(r).reduce((acc, n) => acc + n, 0)
}

function PreviewExitoso({
  parseado,
  modo,
  onModoChange,
  onCancelar,
  onConfirmar,
  cargando,
  confirmReemplazar,
  onCancelarConfirmReemplazar
}: {
  parseado: ResultadoParseo
  modo: ModoCarga
  onModoChange: (m: ModoCarga) => void
  onCancelar: () => void
  onConfirmar: () => void
  cargando: boolean
  confirmReemplazar: boolean
  onCancelarConfirmReemplazar: () => void
}): React.JSX.Element {
  const total = sumarResumen(parseado.resumen)

  if (confirmReemplazar) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-error/30 bg-error-bg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="shrink-0 text-error-strong" />
            <div>
              <p className="text-sm font-semibold text-error-strong">¿Estás seguro?</p>
              <p className="mt-1 text-sm text-text">
                Esto va a <strong>BORRAR</strong> todos los marcos, vidrios, listas de medidas y
                proveedores actuales antes de cargar los nuevos. Es destructivo y no se puede
                deshacer (salvo restaurar un respaldo).
              </p>
              <p className="mt-2 text-xs text-text-muted">
                Si solo quieres actualizar precios sin perder lo existente, usa el modo
                &quot;Actualizar y agregar&quot;.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancelarConfirmReemplazar}>
            Volver
          </Button>
          <Button
            onClick={onConfirmar}
            disabled={cargando}
            className="flex-1 bg-error hover:bg-error/90"
          >
            {cargando ? <Spinner size="sm" /> : null}
            Sí, reemplazar todo
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success-bg p-3">
        <CheckCircle2 size={20} className="shrink-0 text-success-strong" />
        <p className="text-sm text-success-strong">
          Plantilla válida. Detectamos <strong>{total} elementos</strong> listos para cargar.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">
          Detalle por hoja
        </p>
        <div className="space-y-1 rounded-md bg-surface-muted/50 p-3">
          {(Object.keys(parseado.resumen) as (keyof ResumenParseo)[]).map((k) => (
            <div key={k} className="flex items-center justify-between text-sm">
              <span className="text-text-muted">{RESUMEN_LABELS[k]}</span>
              <span
                className={cn(
                  'tabular-nums font-medium',
                  parseado.resumen[k] === 0 ? 'text-text-soft' : 'text-text'
                )}
              >
                {parseado.resumen[k]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-soft">
          Modo de carga
        </p>
        <div className="space-y-2">
          {(Object.keys(MODO_LABELS) as ModoCarga[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModoChange(m)}
              className={cn(
                'block w-full rounded-md border-2 p-3 text-left transition-colors cursor-pointer',
                modo === m
                  ? m === 'reemplazar'
                    ? 'border-error bg-error-bg/30'
                    : 'border-accent bg-accent/10'
                  : 'border-border hover:border-border-strong'
              )}
            >
              <p
                className={cn(
                  'text-sm font-semibold',
                  m === 'reemplazar' && modo === m ? 'text-error-strong' : 'text-text'
                )}
              >
                {MODO_LABELS[m].titulo}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">{MODO_LABELS[m].descripcion}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button onClick={onConfirmar} disabled={cargando} className="flex-1">
          {cargando ? <Spinner size="sm" /> : <FileSpreadsheet size={16} />}
          {cargando ? 'Cargando...' : 'Cargar a la app'}
        </Button>
      </div>
    </div>
  )
}

function PreviewConErrores({
  parseado,
  onCerrar
}: {
  parseado: ResultadoParseo
  onCerrar: () => void
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-warning/30 bg-warning-bg p-3">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="shrink-0 text-warning-strong" />
          <div>
            <p className="text-sm font-semibold text-warning-strong">
              La plantilla tiene {parseado.errores.length}{' '}
              {parseado.errores.length === 1 ? 'error' : 'errores'}
            </p>
            <p className="mt-1 text-xs text-text">
              No se cargó nada en la app. Corrige los siguientes puntos en el Excel y vuelve a
              subirlo.
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-md border border-border">
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
                Campo
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Problema
              </th>
            </tr>
          </thead>
          <tbody>
            {parseado.errores.map((e, i) => (
              <tr key={i} className="border-t border-border hover:bg-surface-muted/40">
                <td className="px-3 py-2 font-mono text-xs text-text">{e.hoja}</td>
                <td className="px-3 py-2 tabular-nums text-text-muted">
                  {e.fila > 0 ? e.fila : '—'}
                </td>
                <td className="px-3 py-2 text-text-muted">{e.campo ?? '—'}</td>
                <td className="px-3 py-2 text-error-strong">{e.mensaje}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={onCerrar} className="flex-1">
          Cerrar y corregir
        </Button>
      </div>
    </div>
  )
}
