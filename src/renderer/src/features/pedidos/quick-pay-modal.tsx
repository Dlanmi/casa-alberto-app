// QuickPayModal — modal compacto para cobrar saldo pendiente desde el
// kanban con un solo gesto (drag a Entregado o drop zone "Cobrar abono").
//
// Dos modos:
//   - 'cobrar_y_entregar': exige cobro completo, mueve estado a entregado
//     en una sola transacción atómica (endpoint cobrarYEntregar).
//   - 'solo_cobrar': permite cobro parcial, NO cambia estado, registra
//     pago contra la factura activa (endpoint registrarPago).
//
// El monto pre-llena con el saldo completo (caso más común). El método
// de pago se obtiene de la lista de constantes del schema (escalable).
// Atajos de teclado: Enter confirma, Esc cancela.
import { useEffect, useMemo, useState } from 'react'
import { Banknote, CreditCard, Wallet, AlertCircle } from 'lucide-react'
import { Modal } from '@renderer/components/ui/modal'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Spinner } from '@renderer/components/ui/spinner'
import { GuidanceHint } from '@renderer/components/shared/guidance-hint'
import { useToast } from '@renderer/contexts/toast-context'
import { useMoneyInput } from '@renderer/lib/use-money-input'
import { formatCOP, hoyISO } from '@renderer/lib/format'
import { DEFAULT_LIST_QUERY_LIMIT } from '@renderer/lib/constants'
import { cn } from '@renderer/lib/cn'
import type { LucideIcon } from 'lucide-react'
import type { Cliente, IpcResult, MetodoPago, Pedido } from '@shared/types'

export type QuickPayMode = 'cobrar_y_entregar' | 'solo_cobrar'

type QuickPayModalProps = {
  pedido: Pedido
  cliente: Cliente | null
  saldoPendiente: number
  totalFactura: number
  modo: QuickPayMode
  onClose: () => void
  onSuccess: () => void
}

// Métodos de pago expuestos al usuario en el modal. Subset visual del enum
// completo (METODOS_PAGO en schema) — efectivo y transferencia son los
// únicos comunes en un negocio físico de papá. Si en el futuro aparece otro
// método, se agrega aquí sin tocar la lógica.
const METODOS_VISIBLES: { key: MetodoPago; label: string; icon: LucideIcon }[] = [
  { key: 'efectivo', label: 'Efectivo', icon: Wallet },
  { key: 'transferencia', label: 'Transferencia', icon: CreditCard }
]

// Storage local para recordar el último método de pago usado. Reduce clicks
// a tu papá: si ayer cobró todo en efectivo, hoy ya viene seleccionado.
const ULTIMO_METODO_KEY = 'casa-alberto:ultimo-metodo-pago'

function leerUltimoMetodo(): MetodoPago {
  try {
    const v = localStorage.getItem(ULTIMO_METODO_KEY)
    if (v === 'efectivo' || v === 'transferencia') return v
  } catch {
    // localStorage puede no existir en algunos contextos (SSR, tests sin jsdom)
  }
  return 'efectivo'
}

function guardarUltimoMetodo(m: MetodoPago): void {
  try {
    localStorage.setItem(ULTIMO_METODO_KEY, m)
  } catch {
    // ignorar — no es crítico
  }
}

export function QuickPayModal({
  pedido,
  cliente,
  saldoPendiente,
  totalFactura,
  modo,
  onClose,
  onSuccess
}: QuickPayModalProps): React.JSX.Element {
  const { showToast } = useToast()
  const yaCobrado = totalFactura - saldoPendiente
  const [monto, setMonto] = useState<number>(saldoPendiente)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(leerUltimoMetodo)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const montoInput = useMoneyInput(monto, setMonto, { min: 0, max: saldoPendiente })

  // En modo "cobrar y entregar" exigimos cobro completo. Mostramos el error
  // antes del submit para que el dueño lo entienda sin esperar al backend.
  const cobroParcialEnEntregar = modo === 'cobrar_y_entregar' && monto < saldoPendiente
  const montoInvalido = monto <= 0 || monto > saldoPendiente
  const submitDeshabilitado = submitting || montoInvalido || cobroParcialEnEntregar

  const titulo = modo === 'cobrar_y_entregar' ? 'Cobrar y entregar' : 'Cobrar abono'
  const labelBoton =
    modo === 'cobrar_y_entregar'
      ? submitting
        ? 'Procesando…'
        : 'Cobrar y entregar'
      : submitting
        ? 'Registrando…'
        : 'Registrar abono'

  // Atajos de teclado: Enter confirma (si el botón está habilitado), Esc cierra.
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Enter' && !submitDeshabilitado) {
        e.preventDefault()
        void handleSubmit()
      }
      if (e.key === 'Escape' && !submitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitDeshabilitado, submitting])

  async function handleSubmit(): Promise<void> {
    setError(null)
    if (montoInvalido) {
      setError('El monto debe ser mayor a 0 y menor o igual al saldo.')
      return
    }
    if (cobroParcialEnEntregar) {
      setError('Para entregar, debes cobrar el saldo completo.')
      return
    }
    setSubmitting(true)
    try {
      if (modo === 'cobrar_y_entregar') {
        const res = (await window.api.pedidos.cobrarYEntregar({
          pedidoId: pedido.id,
          monto,
          metodoPago,
          fecha: hoyISO()
        })) as IpcResult<unknown>
        if (!res.ok) {
          setError(res.error)
          return
        }
        guardarUltimoMetodo(metodoPago)
        showToast({
          tone: 'success',
          title: `${cliente?.nombre ?? 'Cliente'} pagó ${formatCOP(monto)}`,
          message: `Pedido ${pedido.numero} entregado.`
        })
        onSuccess()
        return
      }
      // Modo solo_cobrar: usa el endpoint de pagos existente vía facturas
      // (necesitamos la factura activa para pasarle el id)
      const facturaRes = (await window.api.facturas.listar({
        clienteId: pedido.clienteId,
        limit: DEFAULT_LIST_QUERY_LIMIT
      })) as IpcResult<{ id: number; pedidoId: number; estado: string }[]>
      if (!facturaRes.ok) {
        setError(facturaRes.error)
        return
      }
      const facturaActiva = facturaRes.data.find(
        (f) => f.pedidoId === pedido.id && f.estado !== 'anulada'
      )
      if (!facturaActiva) {
        setError(
          'Este pedido no tiene factura activa. Genera la factura desde el detalle del pedido antes de cobrar.'
        )
        return
      }
      const res = (await window.api.facturas.registrarPago({
        facturaId: facturaActiva.id,
        monto,
        metodoPago,
        fecha: hoyISO()
      })) as IpcResult<unknown>
      if (!res.ok) {
        setError(res.error)
        return
      }
      guardarUltimoMetodo(metodoPago)
      showToast({
        tone: 'success',
        title: `Abono de ${formatCOP(monto)} registrado`,
        message: `${cliente?.nombre ?? 'Cliente'} · pedido ${pedido.numero}`
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al cobrar.')
    } finally {
      setSubmitting(false)
    }
  }

  const advertenciaEntrega = useMemo(() => {
    if (modo !== 'cobrar_y_entregar') return null
    return (
      <GuidanceHint
        tone="info"
        title="Después de cobrar, el pedido pasa a entregado"
        message='Esta operación es atómica: cobro y entrega en un solo paso. Si solo recibes un abono parcial, usa la zona de "Cobrar abono" en el tablero.'
      />
    )
  }, [modo])

  return (
    <Modal open onClose={() => (submitting ? undefined : onClose())} title={titulo} size="md">
      <div className="space-y-5">
        {/* Bloque informativo: cliente + pedido + saldo */}
        <div className="rounded-md border border-border bg-surface-muted/40 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Cliente</span>
            <span className="font-medium text-text">
              {cliente?.nombre ?? 'Sin cliente vinculado'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Pedido</span>
            <span className="font-mono text-xs text-text">{pedido.numero}</span>
          </div>
          <div className="border-t border-border pt-2 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Total del pedido</span>
              <span className="tabular-nums text-text">{formatCOP(totalFactura)}</span>
            </div>
            {yaCobrado > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Ya cobrado</span>
                <span className="tabular-nums text-success-strong">
                  − {formatCOP(yaCobrado)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border pt-1">
              <span className="text-sm font-semibold text-text">Saldo pendiente</span>
              <span className="text-base font-bold tabular-nums text-accent-strong">
                {formatCOP(saldoPendiente)}
              </span>
            </div>
          </div>
        </div>

        {/* Monto */}
        <div className="space-y-2">
          <Input
            label="Monto a cobrar"
            type="text"
            inputMode="decimal"
            min={0}
            max={saldoPendiente}
            value={montoInput.raw}
            onChange={montoInput.handleChange}
            onBlur={montoInput.handleBlur}
            placeholder={String(saldoPendiente)}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setMonto(saldoPendiente)}
            className="text-xs font-medium text-accent-strong hover:text-accent cursor-pointer"
          >
            Cobrar todo ({formatCOP(saldoPendiente)})
          </button>
        </div>

        {/* Método de pago */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
            Método de pago
          </p>
          <div className="grid grid-cols-2 gap-2">
            {METODOS_VISIBLES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetodoPago(m.key)}
                disabled={submitting}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all cursor-pointer',
                  metodoPago === m.key
                    ? 'border-accent bg-accent/10 text-accent-strong'
                    : 'border-border text-text-muted hover:border-border-strong'
                )}
              >
                <m.icon size={16} />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {advertenciaEntrega}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error-bg p-3 text-sm text-error-strong">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitDeshabilitado}
            className="flex-1"
          >
            {submitting ? <Spinner size="sm" /> : <Banknote size={16} />}
            {labelBoton}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
