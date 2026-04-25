import { useIpc } from './use-ipc'
import { mesActualISO } from '@renderer/lib/format'

type PagoClaseMes = {
  id: number
  estudianteId: number
  mes: string
  valorTotal: number
  estado: 'pendiente' | 'parcial' | 'pagado'
  createdAt: string
  updatedAt: string
  totalPagado: number
}

/**
 * Hook que devuelve los pagos mensuales de clase para un mes dado (YYYY-MM).
 * Sin parámetros, usa el mes actual. Lo consume el popup de clase en /agenda
 * para pintar el estado de pago (pagado/parcial/pendiente) al lado de cada
 * estudiante — así papá sabe a quién cobrarle al terminar la clase sin tener
 * que ir a /clases.
 */
export function usePagosClasesMes(mes: string = mesActualISO()): {
  data: PagoClaseMes[] | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  return useIpc<PagoClaseMes[]>(() => window.api.pagosClases.listarMes(mes), [mes])
}
