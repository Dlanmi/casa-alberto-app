// Wizard padre del flujo "pedido multi-trabajo": cliente arriba, lista de
// trabajos cotizados (cada uno se agrega via modal con su propio sub-wizard),
// total + descuento + abono al final, botón "Crear pedido" que invoca
// `pedidos:crearMultiTrabajo`. Auto-save en localStorage clave `multitrabajo:wip`.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { ClientePicker } from '@renderer/components/shared/cliente-picker'
import { ConfirmDialog } from '@renderer/components/shared/confirm-dialog'
import { useToast } from '@renderer/contexts/toast-context'
import { hoyISO } from '@renderer/lib/format'
import type {
  CrearPedidoMultiTrabajoInput,
  CrearPedidoMultiTrabajoResult,
  IpcResult,
  TipoEntrega,
  TrabajoCotizado
} from '@shared/types'
import { ListaTrabajos } from './lista-trabajos'
import { TotalYPago } from './total-y-pago'
import { AgregarTrabajoModal } from './agregar-trabajo-modal'
import {
  STORAGE_KEY_MULTITRABAJO,
  type EstadoMultiTrabajo,
  type TrabajoEnSesion
} from './types'
import { validarEstadoMultiTrabajo } from './draft-validation'

const ESTADO_INICIAL: EstadoMultiTrabajo = {
  cliente: null,
  trabajos: [],
  descuento: null,
  abono: null,
  tipoEntrega: 'estandar',
  notas: '',
  fechaIngreso: hoyISO(),
  fechaEntrega: null
}

export default function MultiTrabajoPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [estado, setEstado] = useState<EstadoMultiTrabajo>(() => {
    // Auto-save: recuperar draft si existe. Validación profunda en
    // `validarEstadoMultiTrabajo` — si CUALQUIER campo del draft es inválido
    // (storage corrupto, tampering, mismatch de versión) descartamos el draft
    // entero y borramos la clave para que la próxima visita arranque limpia.
    // Antes confiábamos en un check `Array.isArray(parsed.trabajos)` que
    // dejaba pasar `{trabajos:[{}]}` y crasheaba el render con TypeError.
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MULTITRABAJO)
      if (!raw) return ESTADO_INICIAL
      const parsed: unknown = JSON.parse(raw)
      const valido = validarEstadoMultiTrabajo(parsed)
      if (valido) return valido
      // Descarte: borramos para evitar re-crashes en la próxima visita.
      localStorage.removeItem(STORAGE_KEY_MULTITRABAJO)
      return ESTADO_INICIAL
    } catch {
      // JSON inválido o lectura bloqueada: limpiar y arrancar de cero.
      try {
        localStorage.removeItem(STORAGE_KEY_MULTITRABAJO)
      } catch {
        /* localStorage bloqueado: ignoramos */
      }
      return ESTADO_INICIAL
    }
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editandoIdLocal, setEditandoIdLocal] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDescartar, setConfirmDescartar] = useState(false)

  // Auto-save al storage cada vez que el estado cambia. Sin debounce — el
  // tamaño del estado es pequeño (<1KB típico) y el papá agradece que no se
  // pierda el progreso si la app se cierra inesperadamente.
  useEffect(() => {
    try {
      // Solo persistimos si hay algo útil; estado vacío se limpia.
      const tieneContenido =
        estado.cliente !== null ||
        estado.trabajos.length > 0 ||
        estado.notas.length > 0
      if (tieneContenido) {
        localStorage.setItem(STORAGE_KEY_MULTITRABAJO, JSON.stringify(estado))
      } else {
        localStorage.removeItem(STORAGE_KEY_MULTITRABAJO)
      }
    } catch {
      /* localStorage lleno o bloqueado: ignoramos, no es crítico */
    }
  }, [estado])

  const subtotalTrabajos = useMemo(
    () => estado.trabajos.reduce((s, t) => s + t.cotizacion.precioLista, 0),
    [estado.trabajos]
  )

  const trabajoEditando = useMemo(
    () => estado.trabajos.find((t) => t.idLocal === editandoIdLocal) ?? null,
    [estado.trabajos, editandoIdLocal]
  )

  function abrirModalAgregar(): void {
    setEditandoIdLocal(null)
    setModalOpen(true)
  }

  function abrirModalEditar(idLocal: string): void {
    setEditandoIdLocal(idLocal)
    setModalOpen(true)
  }

  function cerrarModal(): void {
    setModalOpen(false)
    setEditandoIdLocal(null)
  }

  function confirmarTrabajo(trabajo: TrabajoEnSesion): void {
    setEstado((prev) => {
      const idx = prev.trabajos.findIndex((t) => t.idLocal === trabajo.idLocal)
      if (idx >= 0) {
        // Edición: reemplazar la entrada existente.
        const nuevos = [...prev.trabajos]
        nuevos[idx] = trabajo
        return { ...prev, trabajos: nuevos }
      }
      return { ...prev, trabajos: [...prev.trabajos, trabajo] }
    })
    cerrarModal()
  }

  function eliminarTrabajo(idLocal: string): void {
    setEstado((prev) => ({
      ...prev,
      trabajos: prev.trabajos.filter((t) => t.idLocal !== idLocal)
    }))
  }

  function descartarPedido(): void {
    localStorage.removeItem(STORAGE_KEY_MULTITRABAJO)
    setEstado(ESTADO_INICIAL)
    setConfirmDescartar(false)
    navigate('/cotizador')
  }

  async function crearPedido(): Promise<void> {
    if (!estado.cliente) {
      showToast({ tone: 'error', message: 'Selecciona el cliente antes de crear el pedido.' })
      return
    }
    if (estado.trabajos.length === 0) {
      showToast({ tone: 'error', message: 'Agrega al menos un trabajo antes de crear el pedido.' })
      return
    }

    setCreating(true)
    try {
      const trabajos: TrabajoCotizado[] = estado.trabajos.map((t) => ({
        tipoTrabajo: t.tipoTrabajo,
        datos: {
          clienteId: estado.cliente!.id,
          tipoTrabajo: t.tipoTrabajo,
          descripcion: t.data.descripcionManual || null,
          anchoCm: t.data.anchoCm > 0 ? t.data.anchoCm : null,
          altoCm: t.data.altoCm > 0 ? t.data.altoCm : null,
          muestraMarcoId: t.data.muestraMarcoId,
          anchoPaspartuCm: t.data.conPaspartu ? t.data.anchoPaspartuCm : null,
          tipoPaspartu: t.data.conPaspartu ? t.data.tipoPaspartu : null,
          conSuplemento: t.data.conSuplemento,
          tipoVidrio: t.data.conVidrio ? t.data.tipoVidrio : null,
          porcentajeMateriales: t.data.porcentajeMateriales,
          precioManual: t.data.precioManual,
          costoManualEstimado: t.data.costoManualEstimado,
          precioInstalacion: t.data.precioInstalacion,
          costoInstalacionEstimado: t.data.costoInstalacionEstimado,
          fechaIngreso: estado.fechaIngreso
        },
        cotizacion: t.cotizacion
      }))

      const input: CrearPedidoMultiTrabajoInput = {
        cliente: { tipo: 'existente', id: estado.cliente.id },
        trabajos,
        pedido: {
          fechaIngreso: estado.fechaIngreso,
          fechaEntrega: estado.fechaEntrega,
          tipoEntrega: estado.tipoEntrega,
          notas: estado.notas || null
        },
        descuento:
          estado.descuento && estado.descuento.monto > 0
            ? { monto: estado.descuento.monto, motivo: estado.descuento.motivo || null }
            : null,
        factura: { fecha: estado.fechaIngreso },
        abono:
          estado.abono && estado.abono.monto > 0
            ? {
                monto: estado.abono.monto,
                metodoPago: estado.abono.metodoPago,
                fecha: estado.abono.fecha,
                notas: null
              }
            : null,
        generarPDF: false
      }

      const result = (await window.api.pedidos.crearMultiTrabajo(
        input
      )) as IpcResult<CrearPedidoMultiTrabajoResult>

      if (!result.ok) {
        showToast({ tone: 'error', message: `No pude crear el pedido: ${result.error}` })
        setCreating(false)
        return
      }

      // Limpiamos el draft y vamos a la vista del pedido recién creado.
      localStorage.removeItem(STORAGE_KEY_MULTITRABAJO)
      showToast({
        tone: 'success',
        message: `Pedido ${result.data.pedido.numero} creado con ${trabajos.length} ${trabajos.length === 1 ? 'trabajo' : 'trabajos'}.`
      })
      navigate(`/pedidos?highlight=${result.data.pedido.id}`)
    } catch (err) {
      showToast({
        tone: 'error',
        message: `Error inesperado: ${err instanceof Error ? err.message : String(err)}`
      })
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-5">
      {/* -- Cabecera --------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/cotizador')}>
            <ArrowLeft size={18} />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text">Nuevo pedido</h1>
            <p className="text-sm text-text-muted">
              Cliente con varios trabajos en una sola visita.
            </p>
          </div>
        </div>
        {(estado.cliente || estado.trabajos.length > 0) && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDescartar(true)}>
            Descartar
          </Button>
        )}
      </div>

      {/* -- Cliente ---------------------------------------------------- */}
      <Card padding="md">
        <h3 className="text-base font-semibold text-text mb-2">Cliente</h3>
        <ClientePicker
          value={estado.cliente}
          onChange={(cliente) => setEstado((p) => ({ ...p, cliente }))}
          label=""
        />
      </Card>

      {/* -- Trabajos --------------------------------------------------- */}
      <ListaTrabajos
        trabajos={estado.trabajos}
        onAgregar={abrirModalAgregar}
        onEditar={abrirModalEditar}
        onEliminar={eliminarTrabajo}
      />

      {/* -- Total y pago ----------------------------------------------- */}
      {estado.trabajos.length > 0 && (
        <TotalYPago
          subtotalTrabajos={subtotalTrabajos}
          descuento={estado.descuento}
          onDescuentoChange={(d) => setEstado((p) => ({ ...p, descuento: d }))}
          abono={estado.abono}
          onAbonoChange={(a) => setEstado((p) => ({ ...p, abono: a }))}
          tipoEntrega={estado.tipoEntrega}
          onTipoEntregaChange={(t: TipoEntrega) =>
            setEstado((p) => ({ ...p, tipoEntrega: t }))
          }
          notas={estado.notas}
          onNotasChange={(n) => setEstado((p) => ({ ...p, notas: n }))}
          fechaIngreso={estado.fechaIngreso}
          fechaEntrega={estado.fechaEntrega}
          onFechaEntregaChange={(f) => setEstado((p) => ({ ...p, fechaEntrega: f }))}
        />
      )}

      {/* -- Acciones --------------------------------------------------- */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" size="lg" onClick={() => navigate('/cotizador')}>
          Cancelar
        </Button>
        <Button
          size="lg"
          onClick={crearPedido}
          disabled={creating || !estado.cliente || estado.trabajos.length === 0}
        >
          <FileText size={18} />
          {creating ? 'Creando…' : 'Crear pedido'}
        </Button>
      </div>

      {/* -- Modal agregar/editar trabajo ------------------------------ */}
      <AgregarTrabajoModal
        open={modalOpen}
        onClose={cerrarModal}
        onConfirmar={confirmarTrabajo}
        trabajoEditando={trabajoEditando}
      />

      {/* -- Confirmación descartar ------------------------------------ */}
      <ConfirmDialog
        open={confirmDescartar}
        onClose={() => setConfirmDescartar(false)}
        onConfirm={descartarPedido}
        title="¿Descartar el pedido?"
        message="Vas a perder los trabajos cotizados y los datos del pedido."
        confirmLabel="Descartar"
        danger
      />
    </div>
  )
}
