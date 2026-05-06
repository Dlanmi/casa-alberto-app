// Sección de cierre del pedido multi-trabajo: subtotal de trabajos,
// descuento global opcional, abono opcional, urgencia, notas. Los datos
// viven en el wizard padre (estado `EstadoMultiTrabajo`).
import { Card } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { useMoneyInput } from '@renderer/lib/use-money-input'
import { formatCOP } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import { Banknote, Percent, Zap, StickyNote, CreditCard, Wallet } from 'lucide-react'
import type { TipoEntrega, MetodoPago } from '@shared/types'
import type { DescuentoEnSesion, AbonoEnSesion } from './types'

type Props = {
  subtotalTrabajos: number
  descuento: DescuentoEnSesion | null
  onDescuentoChange: (d: DescuentoEnSesion | null) => void
  abono: AbonoEnSesion | null
  onAbonoChange: (a: AbonoEnSesion | null) => void
  tipoEntrega: TipoEntrega
  onTipoEntregaChange: (t: TipoEntrega) => void
  notas: string
  onNotasChange: (n: string) => void
  fechaIngreso: string
  fechaEntrega: string | null
  onFechaEntregaChange: (f: string | null) => void
}

export function TotalYPago({
  subtotalTrabajos,
  descuento,
  onDescuentoChange,
  abono,
  onAbonoChange,
  tipoEntrega,
  onTipoEntregaChange,
  notas,
  onNotasChange,
  fechaIngreso,
  fechaEntrega,
  onFechaEntregaChange
}: Props): React.JSX.Element {
  const totalFinal = Math.max(0, subtotalTrabajos - (descuento?.monto ?? 0))
  const saldo = Math.max(0, totalFinal - (abono?.monto ?? 0))

  const descuentoMoney = useMoneyInput(
    descuento?.monto ?? 0,
    (n) => onDescuentoChange(n > 0 ? { monto: n, motivo: descuento?.motivo ?? '' } : null),
    { max: subtotalTrabajos }
  )

  const abonoMoney = useMoneyInput(
    abono?.monto ?? 0,
    (n) =>
      onAbonoChange(
        n > 0
          ? {
              monto: n,
              metodoPago: abono?.metodoPago ?? 'efectivo',
              fecha: abono?.fecha ?? fechaIngreso
            }
          : null
      ),
    { max: totalFinal }
  )

  return (
    <Card padding="md" className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-text">Total y pago</h3>
        <p className="text-xs text-text-muted">
          Aplica descuento, recibe un abono y deja notas si quieres.
        </p>
      </div>

      {/* -- Subtotal y descuento --------------------------------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">Subtotal de trabajos</span>
          <span className="font-mono tabular-nums text-text">{formatCOP(subtotalTrabajos)}</span>
        </div>

        <div className="rounded-md border border-border p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={descuento !== null}
              onChange={(e) => {
                if (e.target.checked) {
                  onDescuentoChange({ monto: 0, motivo: '' })
                } else {
                  onDescuentoChange(null)
                }
              }}
              className="h-4 w-4"
            />
            <Percent size={14} className="text-text-muted" aria-hidden="true" />
            <span>Aplicar descuento al pedido</span>
          </label>
          {descuento !== null && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
              <Input
                value={descuentoMoney.raw}
                onChange={descuentoMoney.handleChange}
                onBlur={descuentoMoney.handleBlur}
                placeholder="Monto del descuento"
                inputMode="numeric"
              />
              <Input
                value={descuento.motivo}
                onChange={(e) =>
                  onDescuentoChange({ ...descuento, motivo: e.target.value })
                }
                placeholder="Motivo (opcional)"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-base font-semibold border-t border-border pt-2">
          <span className="text-text">Total a pagar</span>
          <span className="font-mono tabular-nums text-accent-strong text-lg">
            {formatCOP(totalFinal)}
          </span>
        </div>
      </div>

      {/* -- Abono ------------------------------------------------------- */}
      <div className="rounded-md border border-border p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={abono !== null}
            onChange={(e) => {
              if (e.target.checked) {
                onAbonoChange({
                  monto: 0,
                  metodoPago: 'efectivo',
                  fecha: fechaIngreso
                })
              } else {
                onAbonoChange(null)
              }
            }}
            className="h-4 w-4"
          />
          <Banknote size={14} className="text-text-muted" aria-hidden="true" />
          <span>Recibir abono inicial</span>
        </label>
        {abono !== null && (
          <div className="space-y-2 pl-6">
            <Input
              value={abonoMoney.raw}
              onChange={abonoMoney.handleChange}
              onBlur={abonoMoney.handleBlur}
              placeholder="Monto del abono"
              inputMode="numeric"
            />
            <div className="grid grid-cols-2 gap-2">
              {(['efectivo', 'transferencia'] as MetodoPago[]).map((metodo) => {
                const Icono = metodo === 'efectivo' ? Wallet : CreditCard
                const seleccionado = abono.metodoPago === metodo
                return (
                  <button
                    key={metodo}
                    type="button"
                    onClick={() => onAbonoChange({ ...abono, metodoPago: metodo })}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-md border-2 px-3 py-2 text-sm font-medium transition-colors',
                      seleccionado
                        ? 'border-accent bg-accent/10 text-accent-strong'
                        : 'border-border bg-surface text-text-muted hover:border-accent/50'
                    )}
                  >
                    <Icono size={14} />
                    {metodo === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Saldo pendiente</span>
              <span className="font-mono tabular-nums">{formatCOP(saldo)}</span>
            </div>
          </div>
        )}
      </div>

      {/* -- Urgencia ---------------------------------------------------- */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text flex items-center gap-2">
          <Zap size={14} className="text-text-muted" aria-hidden="true" />
          Urgencia del pedido
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['estandar', 'urgente', 'sin_afan'] as TipoEntrega[]).map((t) => {
            const seleccionado = tipoEntrega === t
            const label =
              t === 'estandar' ? 'Estándar' : t === 'urgente' ? 'Urgente' : 'Sin afán'
            return (
              <button
                key={t}
                type="button"
                onClick={() => onTipoEntregaChange(t)}
                className={cn(
                  'rounded-md border-2 px-3 py-2 text-sm font-medium transition-colors',
                  seleccionado
                    ? 'border-accent bg-accent/10 text-accent-strong'
                    : 'border-border bg-surface text-text-muted hover:border-accent/50'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* -- Fecha entrega ---------------------------------------------- */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text">Fecha de entrega</label>
        <Input
          type="date"
          value={fechaEntrega ?? ''}
          onChange={(e) => onFechaEntregaChange(e.target.value || null)}
          min={fechaIngreso}
        />
      </div>

      {/* -- Notas ------------------------------------------------------- */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text flex items-center gap-2">
          <StickyNote size={14} className="text-text-muted" aria-hidden="true" />
          Notas del pedido (opcional)
        </label>
        <textarea
          value={notas}
          onChange={(e) => onNotasChange(e.target.value)}
          rows={2}
          placeholder="Detalles, indicaciones especiales, etc."
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-soft focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
        />
      </div>
    </Card>
  )
}
