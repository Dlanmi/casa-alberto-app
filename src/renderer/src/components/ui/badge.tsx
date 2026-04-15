import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@renderer/lib/cn'
import type { LucideIcon } from 'lucide-react'

const badgeVariants = cva('inline-flex items-center gap-1.5 font-medium rounded-sm text-xs', {
  variants: {
    color: {
      success: 'bg-success-bg text-success-strong border border-success/15',
      warning: 'bg-warning-bg text-warning-strong border border-warning/15',
      error: 'bg-error-bg text-error-strong border border-error/15',
      info: 'bg-info-bg text-info-strong border border-info/15',
      neutral: 'bg-surface-muted text-text-muted border border-border'
    },
    size: {
      sm: 'px-2 py-0.5',
      md: 'px-2.5 py-1'
    }
  },
  defaultVariants: { color: 'neutral', size: 'md' }
})

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    icon?: LucideIcon
  }

export function Badge({
  className,
  color,
  size,
  icon: Icon,
  children,
  ...props
}: BadgeProps): React.JSX.Element {
  return (
    <span className={cn(badgeVariants({ color, size }), className)} {...props}>
      {Icon && <Icon size={14} aria-hidden="true" />}
      {children}
    </span>
  )
}
