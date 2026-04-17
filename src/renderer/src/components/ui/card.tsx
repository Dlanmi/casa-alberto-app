import type { HTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: 'sm' | 'md' | 'lg'
  hoverable?: boolean
}

export function Card({
  className,
  padding = 'md',
  hoverable = false,
  ...props
}: CardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'bg-surface rounded-xl border border-border shadow-1',
        padding === 'sm' && 'p-4',
        padding === 'md' && 'p-6',
        padding === 'lg' && 'p-8',
        hoverable &&
          'transition-[box-shadow,transform] duration-200 hover:shadow-2 hover:-translate-y-px cursor-pointer',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('mb-4', className)} {...props} />
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return <h3 className={cn('text-base font-semibold text-text', className)} {...props} />
}
