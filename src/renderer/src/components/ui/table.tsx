import type { HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

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

type TrProps = HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }

export function Tr({ className, selected, ...props }: TrProps): React.JSX.Element {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-surface-muted',
        selected && 'bg-accent/5 hover:bg-accent/8',
        className
      )}
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
