import type { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

/** Delay incremental entre filas que opt-in a stagger via `staggerIndex`.
 *  Total budget cap = TABLE_STAGGER_MS * TABLE_STAGGER_MAX_INDEX = 300ms
 *  para mantenernos dentro de la regla 1/3 del motion design. */
export const TABLE_STAGGER_MS = 25
/** Index máximo que recibe delay; las filas más allá animan sin retraso
 *  adicional para que el budget total no escale en tablas largas. */
export const TABLE_STAGGER_MAX_INDEX = 12

export function Table({
  className,
  ...props
}: HTMLAttributes<HTMLTableElement>): React.JSX.Element {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm', className)} {...props} />
    </div>
  )
}

export function Thead({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  // AGENT_UX: sticky header so column context stays visible during long scrolls
  return (
    <thead
      className={cn(
        'sticky top-0 z-10 border-b border-border bg-surface shadow-[0_1px_0_var(--color-border)]',
        className
      )}
      {...props}
    />
  )
}

export function Tbody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return (
    <tbody
      className={cn('[&>tr:not(:last-child)]:border-b [&>tr]:border-border', className)}
      {...props}
    />
  )
}

type TrProps = HTMLAttributes<HTMLTableRowElement> & {
  selected?: boolean
  /** Cuando se define, la fila aplica `animate-fade-in-up` con un delay
   *  incremental (cap en TABLE_STAGGER_MAX_INDEX). Útil al renderizar listas
   *  filtradas para que el cambio se sienta orquestado, no abrupto. */
  staggerIndex?: number
  /** Cuando true, la fila usa el lenguaje de hover unificado del sistema
   *  (`row-interactive`: cursor pointer + bg hover). Si onClick está
   *  definido pero interactive no, mantiene compatibilidad con el comportamiento
   *  legacy (hover bg sin cursor). */
  interactive?: boolean
}

export function Tr({
  className,
  selected,
  staggerIndex,
  style,
  interactive,
  ...props
}: TrProps): React.JSX.Element {
  const cappedIndex =
    staggerIndex !== undefined ? Math.min(staggerIndex, TABLE_STAGGER_MAX_INDEX) : undefined
  const composedStyle =
    cappedIndex !== undefined
      ? { ...style, animationDelay: `${cappedIndex * TABLE_STAGGER_MS}ms` }
      : style

  return (
    <tr
      className={cn(
        // Lenguaje unificado de hover en filas: bg-hover + cursor pointer
        // cuando es interactiva; sólo bg-hover cuando no lo es. Las clases
        // utility viven en main.css para que la transición use tokens.
        interactive ? 'row-interactive' : 'transition-colors hover:bg-surface-muted',
        // Filas seleccionadas pisan el bg de hover por especificidad (`!`)
        // — sin esto, `row-interactive:hover` reemplaza el accent y el
        // usuario pierde feedback de "esta es la fila activa".
        selected && 'bg-accent/5 hover:!bg-accent/10',
        cappedIndex !== undefined && 'animate-fade-in-up',
        className
      )}
      style={composedStyle}
      {...props}
    />
  )
}

export function Th({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <th
      className={cn(
        'px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-text-soft',
        className
      )}
      {...props}
    />
  )
}

export function Td({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return <td className={cn('px-4 py-3 text-text', className)} {...props} />
}
