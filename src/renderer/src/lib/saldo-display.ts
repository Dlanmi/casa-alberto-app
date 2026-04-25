// Helper para presentar el saldo de una factura/pedido al usuario. Centraliza
// las tres ramas posibles (pendiente, pagado al día, crédito del cliente)
// para que cualquier vista que muestre el saldo lo haga consistente.
//
// El backend (`getSaldoFactura`, `obtenerSaldosPorPedido`) retorna el saldo
// SIN clamp a 0: cuando hay devoluciones que exceden los pagos restantes
// o un sobrepago directo, el resultado es negativo y representa un crédito
// a favor del cliente. La UI debe diferenciarlo de "saldo 0" (factura al día).

export type SaldoTone = 'success' | 'warning' | 'info'

export type SaldoStatus = {
  tone: SaldoTone
  title: string
  message: string
  label: string
  // Valor siempre positivo listo para `formatCOP`. El signo se transmite
  // en `tone`/`label` para que la presentación visual no muestre "-$X".
  displayValue: number
}

export function saldoStatus(saldo: number): SaldoStatus {
  if (!Number.isFinite(saldo) || saldo === 0) {
    return {
      tone: 'success',
      title: 'Factura al día',
      message:
        'Esta factura ya no requiere más pagos. Puedes generar el PDF o revisar su historial.',
      label: 'Pagado',
      displayValue: 0
    }
  }
  if (saldo > 0) {
    return {
      tone: 'warning',
      title: 'Aún hay saldo pendiente',
      message:
        'Registra aquí el próximo abono para que el saldo y el estado se actualicen automáticamente.',
      label: 'Saldo pendiente',
      displayValue: saldo
    }
  }
  // saldo < 0 → crédito a favor del cliente.
  return {
    tone: 'info',
    title: 'Cliente con crédito a favor',
    message:
      'Los pagos y devoluciones dejaron crédito a favor del cliente. Revisa con él si prefieres reintegrarlo o aplicarlo a otro pedido.',
    label: 'Crédito del cliente',
    displayValue: -saldo
  }
}
