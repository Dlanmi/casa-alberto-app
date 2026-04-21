import {
  Frame,
  Sofa,
  LayoutGrid,
  RectangleHorizontal,
  Square,
  Wrench,
  GlassWater
} from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import { EMOJI_TIPO_TRABAJO } from '@renderer/lib/emojis'
import { useEmojis } from '@renderer/contexts/emojis-context'
import type { TipoTrabajo } from '@shared/types'
import type { LucideIcon } from 'lucide-react'

type TipoTrabajoItem = {
  tipo: TipoTrabajo
  label: string
  description: string
  icon: LucideIcon
}

const TIPOS: TipoTrabajoItem[] = [
  {
    tipo: 'enmarcacion_estandar',
    label: 'Enmarcación',
    description: 'Marco + vidrio + respaldo. Con paspartú opcional.',
    icon: Frame
  },
  {
    tipo: 'acolchado',
    label: 'Acolchado',
    description: 'MDF + espuma 2cm + pegado. Precio por area',
    icon: Sofa
  },
  {
    tipo: 'retablo',
    label: 'Retablo',
    description: '4 listones + tapa MDF. Precio por medida',
    icon: LayoutGrid
  },
  {
    tipo: 'bastidor',
    label: 'Bastidor',
    description: 'Estructura de madera para lienzos. Precio por medida',
    icon: RectangleHorizontal
  },
  {
    tipo: 'tapa',
    label: 'Tapa',
    description: 'Tapa de reemplazo para portarretratos',
    icon: Square
  },
  {
    tipo: 'restauracion',
    label: 'Restauracion',
    description: 'Esculturas, piezas rotas, artesanales. Precio a criterio',
    icon: Wrench
  },
  {
    tipo: 'vidrio_espejo',
    label: 'Vidrio / Espejo',
    description: 'A domicilio para conjuntos. Precio por m2 + instalacion',
    icon: GlassWater
  }
]

type Props = {
  onSelect: (tipo: TipoTrabajo) => void
  onManagePrecios: () => void
}

const BLOQUES: {
  title: string
  description: string
  tipos: TipoTrabajo[]
}[] = [
  {
    title: 'Flujos principales',
    description: 'Los trabajos que más rápido se convierten en pedido.',
    tipos: ['enmarcacion_estandar', 'vidrio_espejo']
  },
  {
    title: 'Acabados y estructuras',
    description: 'Opciones por medida para respaldo, bastidor y tapas.',
    tipos: ['acolchado', 'retablo', 'bastidor', 'tapa']
  },
  {
    title: 'Trabajos especiales',
    description: 'Casos donde conviene una definición manual del alcance y el precio.',
    tipos: ['restauracion']
  }
]

export function TipoTrabajoGrid({ onSelect, onManagePrecios }: Props): React.JSX.Element {
  const { enabled: emojisEnabled } = useEmojis()
  return (
    <div className="space-y-6">
      {BLOQUES.map((bloque) => (
        <section key={bloque.title} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-soft">
              {bloque.title}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{bloque.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TIPOS.filter((item) => bloque.tipos.includes(item.tipo)).map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.tipo}
                  type="button"
                  onClick={() => onSelect(item.tipo)}
                  className={cn(
                    'group flex min-h-40 cursor-pointer flex-col justify-between rounded-lg border border-border bg-surface p-5 text-left shadow-1',
                    'transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-3'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent-strong">
                      {emojisEnabled ? (
                        <span className="text-2xl leading-none" aria-hidden="true">
                          {EMOJI_TIPO_TRABAJO[item.tipo]}
                        </span>
                      ) : (
                        <Icon size={22} strokeWidth={1.7} />
                      )}
                    </div>
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-text-soft">
                      Abrir flujo
                    </span>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-text">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-text-muted">{item.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}

      <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
        <button
          type="button"
          onClick={onManagePrecios}
          className="text-sm font-medium text-accent-strong hover:text-accent cursor-pointer"
        >
          Revisar listas y precios base antes de cotizar &gt;
        </button>
      </div>
    </div>
  )
}
