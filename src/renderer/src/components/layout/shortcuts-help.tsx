// Overlay con la lista completa de atajos de teclado disponibles.
// Se abre con Ctrl+/ (o ⌘+/), desde el botón de "Atajos" en el topbar, o
// desde la acción "Ver atajos" del CommandPalette.
//
// Diseño: lista agrupada por categoría con kbd estilizadas. La fuente de
// verdad de los atajos vive aquí — si cambian, se actualiza este archivo
// y el AppShell consume las constantes para vincularlos al hook.
import { Modal } from '@renderer/components/ui/modal'
import { formatPrimaryShortcut } from '@renderer/lib/shortcuts'
import { SIDEBAR_ITEMS } from '@renderer/lib/constants'

type ShortcutEntry = {
  combo: string
  descripcion: string
}

type ShortcutGrupo = {
  titulo: string
  entradas: ShortcutEntry[]
}

function shiftPrimary(letra: string): string {
  return formatPrimaryShortcut(`Shift+${letra.toUpperCase()}`)
}

function obtenerGrupos(): ShortcutGrupo[] {
  return [
    {
      titulo: 'Búsqueda y navegación',
      entradas: [
        { combo: formatPrimaryShortcut('k'), descripcion: 'Abrir búsqueda global' },
        { combo: formatPrimaryShortcut('n'), descripcion: 'Nueva cotización' },
        { combo: formatPrimaryShortcut('/'), descripcion: 'Mostrar atajos de teclado' },
        { combo: 'Esc', descripcion: 'Cerrar modales y popovers' }
      ]
    },
    {
      titulo: 'Crear rápido',
      entradas: [
        { combo: shiftPrimary('c'), descripcion: 'Nuevo cliente' },
        { combo: shiftPrimary('f'), descripcion: 'Nueva factura' },
        { combo: shiftPrimary('v'), descripcion: 'Nuevo proveedor' },
        { combo: shiftPrimary('p'), descripcion: 'Nuevo pedido (cotizar)' }
      ]
    },
    {
      titulo: 'Módulos',
      // Derivamos de SIDEBAR_ITEMS para no duplicar la fuente de verdad.
      entradas: SIDEBAR_ITEMS.filter((item) => item.shortcut).map((item) => ({
        combo: item.shortcut!,
        descripcion: item.label
      }))
    },
    {
      titulo: 'En el palette',
      entradas: [
        { combo: '↑ ↓', descripcion: 'Navegar resultados' },
        { combo: 'Enter', descripcion: 'Seleccionar resultado' }
      ]
    }
  ]
}

type ShortcutsHelpProps = {
  open: boolean
  onClose: () => void
}

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps): React.JSX.Element {
  const grupos = obtenerGrupos()
  return (
    <Modal open={open} onClose={onClose} title="Atajos de teclado" size="lg">
      <div className="space-y-6">
        <p className="text-sm text-text-muted">
          Estos atajos funcionan en cualquier parte de la aplicación. Las teclas se muestran en el
          formato de tu sistema (Windows o macOS).
        </p>
        {grupos.map((grupo) => (
          <section key={grupo.titulo} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
              {grupo.titulo}
            </h3>
            <div className="rounded-md border border-border bg-surface-muted/30">
              {grupo.entradas.map((entrada, idx) => (
                <div
                  key={`${grupo.titulo}-${idx}`}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-border last:border-b-0 min-h-12"
                >
                  <span className="text-sm text-text">{entrada.descripcion}</span>
                  <kbd className="inline-flex items-center justify-center min-w-12 px-2 py-1 text-xs font-semibold text-text bg-surface border border-border rounded shadow-1">
                    {entrada.combo}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  )
}
