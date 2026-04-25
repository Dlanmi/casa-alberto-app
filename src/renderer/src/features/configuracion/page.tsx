import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Settings,
  Check,
  X,
  Pencil,
  FileSpreadsheet,
  HardDrive,
  Cloud,
  RotateCcw,
  FolderOpen
} from 'lucide-react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useIpcMutation } from '@renderer/hooks/use-ipc-mutation'
import { useToast } from '@renderer/contexts/toast-context'
import { useEmojis } from '@renderer/contexts/emojis-context'
import { Card, CardTitle } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Spinner } from '@renderer/components/ui/spinner'
import { EmptyState } from '@renderer/components/ui/empty-state'
import { PageLoader } from '@renderer/components/ui/spinner'
import { DirectoryScreen } from '@renderer/components/layout/page-frame'
import { cn } from '@renderer/lib/cn'
import type { BackupInfo, Configuracion, IpcResult } from '@shared/types'

type ConfigGroup = {
  title: string
  description: string
  prefix: string[]
}

const CONFIG_GROUPS: ConfigGroup[] = [
  {
    title: 'Datos del negocio',
    description: 'Aparecen en facturas, cotizaciones y documentos PDF',
    prefix: [
      'negocio_',
      'empresa_',
      'nombre',
      'rut',
      'nit',
      'telefono_negocio',
      'direccion_negocio',
      'correo_negocio'
    ]
  },
  {
    title: 'Consecutivos y documentos',
    description: 'Numeración automática de pedidos, facturas y contratos',
    prefix: ['consecutivo_', 'prefijo_']
  },
  {
    title: 'Precios y tarifas',
    description: 'Valores base para el cotizador y listas de precios',
    prefix: ['precio_']
  }
]

const CONFIG_LABELS: Record<string, string> = {
  nombre: 'Nombre del negocio',
  rut: 'RUT',
  nit: 'NIT',
  telefono_negocio: 'Teléfono del negocio',
  direccion_negocio: 'Dirección del negocio',
  correo_negocio: 'Correo del negocio'
}

function findGroup(clave: string): string {
  for (const group of CONFIG_GROUPS) {
    if (group.prefix.some((p) => clave.startsWith(p) || clave === p)) {
      return group.title
    }
  }
  return 'Otros'
}

function humanizeClave(clave: string): string {
  if (CONFIG_LABELS[clave]) return CONFIG_LABELS[clave]
  return clave
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim()
}

function configHint(clave: string): string {
  if (clave.startsWith('precio_')) return 'Usado por el cotizador y las listas de precios'
  if (clave.startsWith('consecutivo_') || clave.startsWith('prefijo_'))
    return 'Define la numeración automática de documentos'
  if (
    clave.startsWith('negocio_') ||
    clave.startsWith('empresa_') ||
    ['nombre', 'rut', 'nit', 'telefono_negocio', 'direccion_negocio', 'correo_negocio'].includes(
      clave
    )
  ) {
    return 'Aparece en documentos y datos de contacto'
  }
  return 'Ajuste interno de la aplicación'
}

const GROUP_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  CONFIG_GROUPS.map((g) => [g.title, g.description])
)

export default function ConfiguracionPage(): React.JSX.Element {
  const { showToast } = useToast()
  const [importing, setImporting] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const {
    data: configs,
    loading,
    refetch
  } = useIpc<Configuracion[]>(() => window.api.configuracion.listar(), [])

  const grouped = useMemo((): Map<string, Configuracion[]> => {
    if (!configs) return new Map<string, Configuracion[]>()
    const map = new Map<string, Configuracion[]>()

    // Ensure all defined groups exist in order
    for (const g of CONFIG_GROUPS) {
      map.set(g.title, [])
    }
    map.set('Otros', [])

    for (const c of configs) {
      const groupName = findGroup(c.clave)
      const list = map.get(groupName) ?? []
      list.push(c)
      map.set(groupName, list)
    }

    // Remove empty groups
    for (const [key, value] of map) {
      if (value.length === 0) map.delete(key)
    }

    return map
  }, [configs])

  const { execute: saveConfig, loading: saving } = useIpcMutation(
    useCallback((clave: string, valor: string) => window.api.configuracion.set(clave, valor), [])
  )

  async function handleSave(clave: string, valor: string): Promise<void> {
    try {
      await saveConfig(clave, valor)
      refetch()
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      setSavedKey(clave)
      savedTimerRef.current = setTimeout(() => setSavedKey(null), 2000)
      showToast('success', `${humanizeClave(clave)} actualizado`)
    } catch {
      showToast('error', 'Error al guardar la configuración')
    }
  }

  async function handleImportExcel(): Promise<void> {
    setImporting(true)
    try {
      const result = (await window.api.excel.importarMarcos()) as IpcResult<{ imported: number }>
      if (result.ok) {
        showToast('success', `Se importaron ${result.data.imported} marcos correctamente`)
      } else {
        showToast('error', result.error)
      }
    } catch {
      showToast('error', 'Error al importar el archivo Excel')
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <PageLoader />

  return (
    <DirectoryScreen
      title="Configuración"
      subtitle="Ajustes base del negocio, numeración de documentos y precios de la operación."
      guidance={{
        title: 'Prioridad sugerida',
        message:
          'Completa primero los datos del negocio y luego revisa precios. Eso deja listos los documentos y el cotizador.',
        actionLabel: importing ? 'Importando...' : 'Importar precios desde Excel',
        onAction: handleImportExcel,
        tone: 'info'
      }}
      primaryAction={{
        label: importing ? 'Importando...' : 'Importar precios desde Excel',
        onClick: handleImportExcel,
        icon: FileSpreadsheet,
        disabled: importing
      }}
    >
      {!configs || configs.length === 0 ? (
        <EmptyState
          icon={Settings}
          title="Sin configuración"
          description="Los datos de tu negocio se configuran aquí. Normalmente esto se llena automáticamente."
          actionLabel={importing ? 'Importando...' : 'Importar precios desde Excel'}
          onAction={handleImportExcel}
        />
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([groupName, items]) => (
            <Card key={groupName} padding="md" className="space-y-4 border-border bg-surface">
              <div>
                <CardTitle>{groupName}</CardTitle>
                {GROUP_DESCRIPTIONS[groupName] && (
                  <p className="text-sm text-text-muted mt-1">{GROUP_DESCRIPTIONS[groupName]}</p>
                )}
              </div>
              <div className="space-y-1">
                {items.map((item) => (
                  <ConfigRow
                    key={item.id}
                    config={item}
                    onSave={handleSave}
                    saving={saving}
                    justSaved={savedKey === item.clave}
                  />
                ))}
              </div>
            </Card>
          ))}
          <AparienciaSection />
          <BackupSection />
        </div>
      )}
    </DirectoryScreen>
  )
}

/* ------------------------------------------------------------------ */
/* Apariencia — toggle de emojis                                      */
/* ------------------------------------------------------------------ */

function AparienciaSection(): React.JSX.Element {
  const { enabled, setEnabled } = useEmojis()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(false)

  async function handleToggle(): Promise<void> {
    setSaving(true)
    try {
      await setEnabled(!enabled)
      showToast('success', !enabled ? 'Emojis activados 🎨' : 'Emojis desactivados')
    } catch {
      showToast('error', 'No se pudo guardar la preferencia')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padding="md" className="space-y-4 border-border bg-surface">
      <div>
        <CardTitle>Apariencia</CardTitle>
        <p className="text-sm text-text-muted mt-1">Ajustes visuales de la aplicación.</p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-md border border-transparent px-3 py-2.5 hover:border-border hover:bg-surface-muted transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">Mostrar emojis</p>
          <p className="text-xs text-text-muted mt-0.5">
            Activa íconos cálidos en estados, categorías y notificaciones. Desactívalo si prefieres
            vista sobria.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Mostrar emojis"
          disabled={saving}
          onClick={handleToggle}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            enabled ? 'bg-accent' : 'bg-border-strong',
            saving && 'opacity-60'
          )}
        >
          <span
            className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-surface shadow-1 transition-transform',
              enabled ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Sección de respaldos                                               */
/* ------------------------------------------------------------------ */

function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatBackupDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function BackupSection(): React.JSX.Element {
  const { showToast } = useToast()
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  const refetch = useCallback(async (): Promise<void> => {
    setLoading(true)
    const res = (await window.api.backup.listar()) as IpcResult<BackupInfo[]>
    if (res.ok) setBackups(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  async function handleCrearAhora(): Promise<void> {
    setCreating(true)
    try {
      const res = (await window.api.backup.crearAhora()) as IpcResult<BackupInfo>
      if (res.ok) {
        showToast({
          tone: 'success',
          title: 'Respaldo creado',
          message: `${res.data.nombre} (${formatBackupSize(res.data.tamanoBytes)})`
        })
        await refetch()
      } else {
        showToast({ tone: 'error', title: 'No se pudo crear el respaldo', message: res.error })
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleRestaurar(b: BackupInfo): Promise<void> {
    const confirmado = window.confirm(
      `¿Restaurar el respaldo "${b.nombre}"?\n\n` +
        'La base de datos actual se va a reemplazar. Se guarda una copia ' +
        'de seguridad con sufijo .pre-restore por si quieres volver atrás. ' +
        'Ten en cuenta que vas a necesitar cerrar y volver a abrir la app.'
    )
    if (!confirmado) return
    setRestoring(b.path)
    try {
      // Usar restaurarPorId (nombre del archivo) en lugar del path completo.
      // El main resuelve el path internamente desde el directorio permitido,
      // evitando exponer el filesystem al renderer.
      const res = (await window.api.backup.restaurarPorId(b.nombre)) as IpcResult<void>
      if (res.ok) {
        showToast({
          tone: 'success',
          title: 'Respaldo restaurado',
          message: 'Cierra y vuelve a abrir la app para ver los datos restaurados.'
        })
      } else {
        showToast({ tone: 'error', title: 'No se pudo restaurar', message: res.error })
      }
    } finally {
      setRestoring(null)
    }
  }

  async function handleAbrirCarpeta(): Promise<void> {
    const res = (await window.api.backup.abrirCarpeta()) as IpcResult<void>
    if (!res.ok) {
      showToast({ tone: 'error', title: 'No se pudo abrir la carpeta', message: res.error })
    }
  }

  return (
    <Card padding="md" className="space-y-4 border-border bg-surface">
      <div>
        <CardTitle>Respaldos</CardTitle>
        <p className="text-sm text-text-muted mt-1">
          Copias automáticas de tu base de datos. Se crea una cada 24 horas y se guardan los 7
          respaldos más recientes. Si algo sale mal, puedes restaurar desde aquí.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleCrearAhora} disabled={creating}>
          {creating ? <Spinner size="sm" /> : <Cloud size={16} />}
          {creating ? 'Creando respaldo…' : 'Crear respaldo ahora'}
        </Button>
        <Button variant="secondary" onClick={handleAbrirCarpeta}>
          <FolderOpen size={16} />
          Abrir carpeta de respaldos
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : backups.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-text-muted">
          <HardDrive size={32} className="mx-auto mb-2 text-text-soft" />
          Aún no hay respaldos. Haz clic en &quot;Crear respaldo ahora&quot; para hacer el primero.
        </div>
      ) : (
        <div className="space-y-1">
          {backups.map((b) => (
            <div
              key={b.path}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 border border-transparent hover:border-border hover:bg-surface-muted transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success-bg shrink-0">
                <HardDrive size={16} className="text-success-strong" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{b.nombre}</p>
                <p className="text-xs text-text-muted">
                  {formatBackupDate(b.fecha)} · {formatBackupSize(b.tamanoBytes)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRestaurar(b)}
                disabled={restoring !== null}
              >
                {restoring === b.path ? <Spinner size="sm" /> : <RotateCcw size={14} />}
                Restaurar
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Config Row                                                         */
/* ------------------------------------------------------------------ */

function ConfigRow({
  config,
  onSave,
  saving,
  justSaved
}: {
  config: Configuracion
  onSave: (clave: string, valor: string) => Promise<void>
  saving: boolean
  justSaved: boolean
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(config.valor)

  function handleEdit(): void {
    setEditValue(config.valor)
    setEditing(true)
  }

  function handleCancel(): void {
    setEditValue(config.valor)
    setEditing(false)
  }

  async function handleSave(): Promise<void> {
    if (editValue === config.valor) {
      setEditing(false)
      return
    }
    await onSave(config.clave, editValue)
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  return (
    <div
      className={cn(
        ' -mx-3 flex items-center gap-4 rounded-md px-3 py-2.5',
        'border border-transparent transition-colors hover:border-border hover:bg-surface-muted'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text">{humanizeClave(config.clave)}</p>
        {config.descripcion ? (
          <p className="text-xs text-text-muted truncate">{config.descripcion}</p>
        ) : (
          <p className="text-xs text-text-muted truncate">{configHint(config.clave)}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className={cn(
                'h-11 w-48 rounded-md border border-border bg-surface px-3 text-sm text-text',
                'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
              )}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-success-strong hover:bg-success-bg transition-colors"
              aria-label="Guardar"
            >
              <Check size={18} />
            </button>
            <button
              onClick={handleCancel}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text transition-colors"
              aria-label="Cancelar"
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <>
            {justSaved && (
              <span className="text-xs text-success-strong flex items-center gap-1">
                <Check size={14} />
                Guardado
              </span>
            )}
            <span className="max-w-75 truncate text-sm text-text-muted tabular-nums">
              {config.valor}
            </span>
            <button
              onClick={handleEdit}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text transition-colors"
              aria-label="Editar"
            >
              <Pencil size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
