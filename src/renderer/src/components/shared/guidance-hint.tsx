import { Info, AlertTriangle, CheckCircle, Sparkles, type LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

type GuidanceTone = 'info' | 'warning' | 'success' | 'accent'

type GuidanceHintProps = {
  tone?: GuidanceTone
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

const toneStyles: Record<
  GuidanceTone,
  { icon: LucideIcon; container: string; iconColor: string; button: string }
> = {
  info: {
    icon: Info,
    container: 'bg-info-bg border-info/20',
    iconColor: 'text-info-strong',
    button: 'text-info-strong hover:text-info'
  },
  warning: {
    icon: AlertTriangle,
    container: 'bg-warning-bg border-warning/20',
    iconColor: 'text-warning-strong',
    button: 'text-warning-strong hover:text-warning'
  },
  success: {
    icon: CheckCircle,
    container: 'bg-success-bg border-success/20',
    iconColor: 'text-success-strong',
    button: 'text-success-strong hover:text-success'
  },
  accent: {
    icon: Sparkles,
    container: 'bg-surface-raised border-accent/20',
    iconColor: 'text-accent-strong',
    button: 'text-accent-strong hover:text-accent'
  }
}

export function GuidanceHint({
  tone = 'info',
  title,
  message,
  actionLabel,
  onAction,
  className
}: GuidanceHintProps): React.JSX.Element {
  const { icon: Icon, container, iconColor, button } = toneStyles[tone]

  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3', container, className)}>
      <Icon size={18} className={cn('mt-0.5 shrink-0', iconColor)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="text-sm text-text-muted">{message}</p>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className={cn('mt-2 text-sm font-medium cursor-pointer', button)}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
