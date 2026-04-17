import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

export type BreadcrumbItem = {
  label: string
  to?: string
}

type BreadcrumbsProps = {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps): React.JSX.Element {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1.5 text-sm text-text-muted', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight size={14} aria-hidden className="text-text-muted" />}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="rounded hover:text-accent-strong hover:underline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast && 'font-medium text-text')} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
