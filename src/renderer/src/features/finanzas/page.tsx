import { useState, useCallback, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useIpcMutation } from '@renderer/hooks/use-ipc-mutation'
import { useToast } from '@renderer/contexts/toast-context'
import { Card } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Modal } from '@renderer/components/ui/modal'
import { Input } from '@renderer/components/ui/input'
import { Select } from '@renderer/components/ui/select'
import { SearchInput } from '@renderer/components/ui/search-input'
import { Tabs } from '@renderer/components/ui/tabs'
import { Table, Thead, Tbody, Tr, Th, Td } from '@renderer/components/ui/table'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { CashRegisterIllustration } from '@renderer/components/illustrations'
import { Tooltip } from '@renderer/components/ui/tooltip'
import { MetricSkeleton, TableSkeleton } from '@renderer/components/ui/skeleton'
import { PrecioDisplay } from '@renderer/components/shared/precio-display'
import { FechaDisplay } from '@renderer/components/shared/fecha-display'
import { MetricCard, OperationalBoard, PageSection } from '@renderer/components/layout/page-frame'
import { CategoryBreakdown } from './category-breakdown'
import { CATEGORIA_FIN_ICON } from '@renderer/lib/iconography'
import { EMOJI_CATEGORIA_FINANZAS } from '@renderer/lib/emojis'
import { useEmojis } from '@renderer/contexts/emojis-context'
import { formatCOP, mesActualISO, hoyISO } from '@renderer/lib/format'
import { cn } from '@renderer/lib/cn'
import type {
  MovimientoFinanciero,
  TipoMovimientoFin,
  CategoriaMovimiento,
  IpcResult
} from '@shared/types'
import { TIPOS_MOVIMIENTO_FIN, CATEGORIAS_MOVIMIENTO } from '@shared/types'

type ResumenMensual = {
  mes: string
  ingresos: number
  gastos: number
  balance: number
  porCategoria: { categoria: string; tipo: string; total: number }[]
}

const CATEGORIA_LABEL: Record<string, string> = {
  enmarcacion: 'Enmarcación',
  clases: 'Clases',
  kit_dibujo: 'Kit de dibujo',
  contratos: 'Contratos',
  restauracion: 'Restauración',
  materiales: 'Materiales',
  servicios: 'Servicios',
  transporte: 'Transporte',
  arriendo: 'Arriendo',
  devolucion: 'Devolución',
  otro: 'Otro'
}

const TIPO_LABEL: Record<string, string> = {
  ingreso: 'Ingreso',
  gasto: 'Gasto'
}

const MES_NOMBRE: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre'
}

function formatMesLabel(mes: string): string {
  const [year, month] = mes.split('-')
  return `${MES_NOMBRE[month] ?? month} ${year}`
}

function shiftMonth(mes: string, delta: number): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function FinanzasPage(): React.JSX.Element {
  const [showModal, setShowModal] = useState(false)
  const [mes, setMes] = useState(mesActualISO)
  const [search, setSearch] = useState('')
  const [tipoTab, setTipoTab] = useState('todos')
  const { showToast } = useToast()
  const { enabled: emojisEnabled } = useEmojis()

  const mesActual = mesActualISO()
  const isCurrentMonth = mes === mesActual

  const {
    data: resumen,
    loading: loadingResumen,
    refetch: refetchResumen
  } = useIpc<ResumenMensual>(() => window.api.finanzas.resumenMensual(mes), [mes])

  const desde = `${mes}-01`
  const hasta = `${mes}-31`

  const {
    data: movimientos,
    loading: loadingMov,
    refetch: refetchMov
  } = useIpc<MovimientoFinanciero[]>(
    () => window.api.finanzas.listarMovimientos({ desde, hasta, limit: 100 }),
    [mes]
  )

  const filteredMovimientos = useMemo(() => {
    if (!movimientos) return []
    let result = movimientos

    if (tipoTab === 'ingresos') result = result.filter((m) => m.tipo === 'ingreso')
    if (tipoTab === 'gastos') result = result.filter((m) => m.tipo === 'gasto')

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          (m.descripcion ?? '').toLowerCase().includes(q) ||
          (CATEGORIA_LABEL[m.categoria] ?? m.categoria).toLowerCase().includes(q)
      )
    }

    return result
  }, [movimientos, tipoTab, search])

  const balance = resumen?.balance ?? 0

  if (loadingResumen || loadingMov) {
    return (
      <OperationalBoard title="Finanzas" subtitle="Cargando datos del mes...">
        <MetricSkeleton count={3} />
        <TableSkeleton rows={5} />
      </OperationalBoard>
    )
  }

  return (
    <OperationalBoard
      title="Finanzas"
      subtitle="Sigue ingresos, gastos y balance del mes con una vista operativa y legible."
      primaryAction={{
        label: 'Registrar movimiento',
        onClick: () => setShowModal(true),
        icon: Plus
      }}
      secondaryActions={[
        {
          label: 'Exportar Excel',
          onClick: async () => {
            try {
              const res = (await window.api.excel.exportarFinanzas(mes)) as IpcResult<string>
              if (res.ok) showToast('success', 'Exportado a ' + res.data)
              else showToast('error', res.error)
            } catch (err) {
              console.error('Excel export failed:', err)
              showToast('error', 'Error al exportar')
            }
          },
          icon: Download,
          variant: 'secondary'
        }
      ]}
      filters={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMes(shiftMonth(mes, -1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={18} />
            </Button>
            <span className="min-w-0 sm:min-w-35 text-center text-sm font-medium text-text">
              {formatMesLabel(mes)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMes(shiftMonth(mes, 1))}
              disabled={isCurrentMonth}
              aria-label="Mes siguiente"
            >
              <ChevronRight size={18} />
            </Button>
          </div>
          {!isCurrentMonth && (
            <Button variant="ghost" size="xs" onClick={() => setMes(mesActual)}>
              Hoy
            </Button>
          )}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Ingresos"
          value={
            <PrecioDisplay value={resumen?.ingresos ?? 0} size="lg" className="text-success" />
          }
          detail="Cobros, ventas y movimientos a favor"
          tone="success"
          icon={TrendingUp}
        />
        <MetricCard
          label="Gastos"
          value={<PrecioDisplay value={resumen?.gastos ?? 0} size="lg" className="text-error" />}
          detail="Salidas registradas este mes"
          tone="error"
          icon={TrendingDown}
        />
        <MetricCard
          label="Balance"
          value={
            <PrecioDisplay
              value={balance}
              size="lg"
              className={cn(balance >= 0 ? 'text-info' : 'text-error')}
            />
          }
          detail="Diferencia entre ingresos y gastos"
          tone="info"
          icon={DollarSign}
        />
      </div>

      {resumen && resumen.porCategoria.length > 0 && (
        <PageSection title="Desglose por categoría">
          <Card padding="md">
            <CategoryBreakdown
              porCategoria={resumen.porCategoria}
              totalIngresos={resumen.ingresos}
              totalGastos={resumen.gastos}
            />
          </Card>
        </PageSection>
      )}

      <PageSection
        title="Movimientos"
        description={
          filteredMovimientos.length > 0
            ? `${filteredMovimientos.length} movimientos${search ? ' encontrados' : ''}`
            : undefined
        }
        action={
          <Button variant="secondary" size="sm" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Registrar
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Tabs
            tabs={[
              { key: 'todos', label: 'Todos' },
              { key: 'ingresos', label: 'Ingresos' },
              { key: 'gastos', label: 'Gastos' }
            ]}
            active={tipoTab}
            onChange={setTipoTab}
            idBase="finanzas-tipo"
          />
          <div className="w-64">
            <SearchInput
              placeholder="Buscar por descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
            />
          </div>
        </div>

        {filteredMovimientos.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            illustration={!search ? <CashRegisterIllustration size={140} /> : undefined}
            title={search ? 'Sin resultados' : 'Sin movimientos este mes'}
            description={
              search
                ? `No hay movimientos que coincidan con "${search}".`
                : 'Cuando registres un cobro o un gasto, aparecerá aquí. También se registran automáticamente desde facturas y clases.'
            }
            actionLabel={search ? undefined : 'Registrar movimiento'}
            onAction={search ? undefined : () => setShowModal(true)}
          />
        ) : (
          <Card padding="md" className="border-border bg-surface max-h-[60vh] overflow-y-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>Tipo</Th>
                  <Th>Categoría</Th>
                  <Th>Descripción</Th>
                  <Th className="text-right">Monto</Th>
                  <Th>Fecha</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredMovimientos.map((m) => {
                  const CategoriaIcon = CATEGORIA_FIN_ICON[m.categoria] ?? DollarSign
                  const categoriaEmoji = EMOJI_CATEGORIA_FINANZAS[m.categoria]
                  const fullDescripcion = m.descripcion || ''
                  return (
                    <Tr key={m.id}>
                      <Td>
                        {/* AGENT_UX: Badge con icono direccional (flecha arriba=ingreso,
                            abajo=gasto) para lectura en 0.5s. */}
                        <Badge
                          color={m.tipo === 'ingreso' ? 'success' : 'error'}
                          icon={m.tipo === 'ingreso' ? TrendingUp : TrendingDown}
                        >
                          {TIPO_LABEL[m.tipo] ?? m.tipo}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5 text-text-muted">
                          {emojisEnabled && categoriaEmoji ? (
                            <span aria-hidden="true" className="text-base leading-none">
                              {categoriaEmoji}
                            </span>
                          ) : (
                            <CategoriaIcon size={14} className="text-accent-strong" />
                          )}
                          {CATEGORIA_LABEL[m.categoria] ?? m.categoria}
                        </span>
                      </Td>
                      <Td className="max-w-80 text-text-muted">
                        {fullDescripcion.length > 40 ? (
                          <Tooltip content={fullDescripcion}>
                            <span className="block truncate">{fullDescripcion}</span>
                          </Tooltip>
                        ) : (
                          <span className="block truncate">{fullDescripcion || '—'}</span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <span
                          className={cn(
                            'tabular-nums text-sm font-semibold',
                            m.tipo === 'ingreso' ? 'text-success-strong' : 'text-error-strong'
                          )}
                        >
                          {m.tipo === 'ingreso' ? '+' : '−'}
                          {formatCOP(m.monto)}
                        </span>
                      </Td>
                      <Td>
                        <FechaDisplay fecha={m.fecha} relative />
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          </Card>
        )}
      </PageSection>

      {showModal && (
        <MovimientoModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            refetchResumen()
            refetchMov()
            showToast('success', 'Movimiento registrado')
          }}
        />
      )}
    </OperationalBoard>
  )
}

/* ------------------------------------------------------------------ */
/* Movimiento Modal                                                   */
/* ------------------------------------------------------------------ */

function MovimientoModal({
  onClose,
  onSuccess
}: {
  onClose: () => void
  onSuccess: () => void
}): React.JSX.Element {
  const [form, setForm] = useState({
    tipo: 'gasto' as TipoMovimientoFin,
    categoria: 'otro' as CategoriaMovimiento,
    descripcion: '',
    monto: '',
    fecha: hoyISO()
  })

  const { execute, loading } = useIpcMutation(
    useCallback(
      (data: {
        tipo: TipoMovimientoFin
        categoria: CategoriaMovimiento
        descripcion: string | null
        monto: number
        fecha: string
      }) => window.api.finanzas.registrarManual(data),
      []
    )
  )

  const tipoOptions = TIPOS_MOVIMIENTO_FIN.map((t) => ({
    value: t,
    label: TIPO_LABEL[t] ?? t
  }))

  const categoriaOptions = CATEGORIAS_MOVIMIENTO.map((c) => ({
    value: c,
    label: `${EMOJI_CATEGORIA_FINANZAS[c] ?? ''} ${CATEGORIA_LABEL[c] ?? c}`.trim()
  }))

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const monto = parseFloat(form.monto)
    if (isNaN(monto) || monto <= 0) return
    try {
      await execute({
        tipo: form.tipo,
        categoria: form.categoria,
        descripcion: form.descripcion || null,
        monto,
        fecha: form.fecha
      })
      onSuccess()
    } catch {
      // handled by hook
    }
  }

  return (
    <Modal open onClose={onClose} title="Registrar movimiento" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-muted">
          Usa este formulario para registrar gastos o ingresos que no vengan de facturas, clases o
          ventas automáticas.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Tipo"
            options={tipoOptions}
            value={form.tipo}
            onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as TipoMovimientoFin }))}
          />
          <Select
            label="Categoria"
            options={categoriaOptions}
            value={form.categoria}
            onChange={(e) =>
              setForm((p) => ({ ...p, categoria: e.target.value as CategoriaMovimiento }))
            }
          />
        </div>
        <Input
          label="Descripción"
          value={form.descripcion}
          onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
          placeholder="Descripción del movimiento"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Monto"
            type="number"
            min="1"
            value={form.monto}
            onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
            placeholder="0"
          />
          <Input
            label="Fecha"
            type="date"
            value={form.fecha}
            onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
          />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
